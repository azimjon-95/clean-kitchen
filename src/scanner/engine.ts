/**
 * Заменяемый OCR-движок. Весь остальной код работает только с интерфейсом OcrEngine,
 * поэтому Tesseract можно заменить на другой движок (PaddleOCR, облачный API и т.д.)
 * без изменений в разборе документа и интерфейсе.
 */
import type { Rect } from "./types";

export type OcrWord = { text: string; conf: number; bbox: Rect };
export type OcrLine = { text: string; conf: number; bbox: Rect; words: OcrWord[] };
export type OcrResult = { text: string; conf: number; lines: OcrLine[] };

export type OcrOptions = {
  /** Область изображения (x0,y0,x1,y1), если нужно распознать только её */
  rect?: Rect;
  mode?: "page" | "block" | "line";
  /** Допустимые символы (для числовых ячеек) */
  whitelist?: string;
  /** Увеличить область перед распознаванием (для повторного OCR проблемной зоны) */
  upscale?: number;
};

export interface OcrEngine {
  readonly name: string;
  init(onProgress?: (p: number, status: string) => void): Promise<void>;
  recognize(image: HTMLCanvasElement, opt?: OcrOptions): Promise<OcrResult>;
  terminate(): Promise<void>;
}

export class TesseractEngine implements OcrEngine {
  readonly name = "Tesseract 7 (rus, локально)";
  private worker: any = null;
  private cur = "";
  private progress?: (p: number, s: string) => void;

  async init(onProgress?: (p: number, status: string) => void) {
    if (this.worker) return;
    this.progress = onProgress;
    const { createWorker } = await import("tesseract.js");
    const base = `${import.meta.env.BASE_URL}tesseract/`;
    this.worker = await createWorker("rus", 1, {
      workerPath: `${base}worker.min.js`,
      corePath: base,
      langPath: base,
      gzip: true,
      workerBlobURL: false,
      logger: (m: any) => this.progress?.(m.progress ?? 0, m.status ?? "")
    } as any);
  }

  async recognize(image: HTMLCanvasElement, opt: OcrOptions = {}): Promise<OcrResult> {
    if (!this.worker) await this.init();
    const mode = opt.mode ?? "page";
    const psm = mode === "line" ? "7" : mode === "block" ? "6" : "4";
    const key = `${psm}|${opt.whitelist ?? ""}`;
    if (key !== this.cur) {
      await this.worker.setParameters({
        tessedit_pageseg_mode: psm,
        tessedit_char_whitelist: opt.whitelist ?? "",
        preserve_interword_spaces: "1"
      });
      this.cur = key;
    }
    let src: HTMLCanvasElement = image;
    let ox = 0, oy = 0, k = 1;
    const o: any = {};
    if (opt.upscale && opt.upscale > 1 && opt.rect) {
      const [x0, y0, x1, y1] = opt.rect;
      k = opt.upscale;
      const c = document.createElement("canvas");
      c.width = Math.round((x1 - x0) * k) + 40;
      c.height = Math.round((y1 - y0) * k) + 40;
      const g = c.getContext("2d")!;
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      g.imageSmoothingQuality = "high";
      g.drawImage(image, x0, y0, x1 - x0, y1 - y0, 20, 20, (x1 - x0) * k, (y1 - y0) * k);
      src = c; ox = x0 - 20 / k; oy = y0 - 20 / k;
    } else if (opt.rect) {
      const [x0, y0, x1, y1] = opt.rect;
      o.rectangle = { left: Math.round(x0), top: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) };
    }
    const { data } = await this.worker.recognize(src, o, { blocks: true });
    const lines: OcrLine[] = [];
    const mapR = (b: any): Rect => [b.x0 / k + ox, b.y0 / k + oy, b.x1 / k + ox, b.y1 / k + oy];
    for (const bl of data.blocks ?? []) for (const pa of bl.paragraphs ?? []) for (const ln of pa.lines ?? []) {
      const words: OcrWord[] = (ln.words ?? []).map((w: any) => ({ text: w.text, conf: w.confidence, bbox: mapR(w.bbox) }));
      lines.push({ text: (ln.text ?? "").replace(/\s+$/, ""), conf: ln.confidence, bbox: mapR(ln.bbox), words });
    }
    return { text: (data.text ?? "").trim(), conf: data.confidence ?? 0, lines };
  }

  async terminate() {
    try { await this.worker?.terminate(); } catch { /* ignore */ }
    this.worker = null; this.cur = "";
  }
}
