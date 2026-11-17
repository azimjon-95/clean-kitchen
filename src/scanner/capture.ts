import { assessQuality, canvasToBlob, detectQuad, defaultQuad, enhance, rotateCanvas, scaleCanvas, warpToRect } from "./imaging";
import type { PageData, Quad } from "./types";

export type Raw = { canvas: HTMLCanvasElement; quad: Quad; auto: boolean; coverage: number; flat?: boolean };

export function makeRaw(canvas: HTMLCanvasElement, flat = false): Raw {
  if (flat) return { canvas, quad: defaultQuad(canvas.width, canvas.height, 0), auto: true, coverage: 1, flat };
  const { quad, coverage } = detectQuad(canvas);
  return { canvas, quad: quad ?? defaultQuad(canvas.width, canvas.height), auto: !!quad, coverage };
}

export const rotateRaw = (r: Raw): Raw => makeRaw(rotateCanvas(r.canvas, 1), r.flat);

/** Выпрямление + улучшение + оценка качества. Исходное фото сохраняется отдельно. */
export async function buildPage(r: Raw, id: string): Promise<PageData> {
  const warped = warpToRect(r.canvas, r.quad);
  const { canvas, shadow } = enhance(warped);
  const quality = assessQuality(r.canvas, warped, shadow, r.coverage);
  const orig = scaleCanvas(r.canvas, Math.min(r.canvas.width, 1800), Math.min(r.canvas.width, 1800) * (r.canvas.height / r.canvas.width));
  const original = await canvasToBlob(orig, "image/jpeg", 0.82);
  const t = scaleCanvas(canvas, 160, 160 * (canvas.height / canvas.width));
  return { id, original, rectified: canvas, thumb: t.toDataURL("image/jpeg", 0.6), quality };
}
