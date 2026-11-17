import { makeCanvas } from "./imaging";

/** Рендер страниц PDF в canvas (до 12 страниц) */
export async function renderPdf(file: Blob, maxPages = 12): Promise<HTMLCanvasElement[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out: HTMLCanvasElement[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, 2600 / Math.max(base.width, base.height));
    const vp = page.getViewport({ scale });
    const c = makeCanvas(vp.width, vp.height);
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvas: c, canvasContext: g, viewport: vp }).promise;
    out.push(c);
  }
  return out;
}
