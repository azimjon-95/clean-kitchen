/**
 * Обработка изображений для сканера документов (Canvas, без внешних зависимостей):
 * поиск границ листа, коррекция перспективы, выравнивание освещения/контраста, оценка качества.
 * Реализовано на чистом TypeScript, чтобы работало одинаково в iOS Safari, Android и на ПК.
 */
import type { Pt, QualityIssue, QualityReport, Quad } from "./types";

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
export const ctx2d = (c: HTMLCanvasElement) => c.getContext("2d", { willReadFrequently: true })!;

export function scaleCanvas(src: HTMLCanvasElement | HTMLVideoElement, w: number, h: number): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Загрузка файла/фото с учётом EXIF-ориентации (iOS) */
export async function canvasFromBlob(file: Blob, maxSide = 4096): Promise<HTMLCanvasElement> {
  let w = 0, h = 0;
  let draw: (g: CanvasRenderingContext2D, W: number, H: number) => void;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    w = bmp.width; h = bmp.height;
    draw = (g, W, H) => { g.drawImage(bmp, 0, 0, W, H); bmp.close?.(); };
  } catch {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Не удалось открыть изображение"));
      i.src = url;
    });
    w = img.naturalWidth; h = img.naturalHeight;
    draw = (g, W, H) => { g.drawImage(img, 0, 0, W, H); URL.revokeObjectURL(url); };
  }
  const s = Math.min(1, maxSide / Math.max(w, h));
  const c = makeCanvas(w * s, h * s);
  draw(ctx2d(c), c.width, c.height);
  return c;
}

export const canvasToBlob = (c: HTMLCanvasElement, type = "image/jpeg", q = 0.9) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), type, q));

export function rotateCanvas(src: HTMLCanvasElement, quarterTurns: number): HTMLCanvasElement {
  const t = ((quarterTurns % 4) + 4) % 4;
  if (t === 0) return src;
  const swap = t % 2 === 1;
  const c = makeCanvas(swap ? src.height : src.width, swap ? src.width : src.height);
  const g = ctx2d(c);
  g.translate(c.width / 2, c.height / 2);
  g.rotate((t * Math.PI) / 2);
  g.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

/* ───────── Поиск границ листа ───────── */

function otsu(hist: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > best) { best = v; thr = t; }
  }
  return thr;
}

const polyArea = (p: Pt[]) => {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return Math.abs(a) / 2;
};

/**
 * Находит четыре угла листа: «светлая» область (по минимальному каналу RGB, чтобы цветной фон
 * не принимался за бумагу) → крупнейшая связная компонента → экстремальные точки.
 * Возвращает null, если лист не найден.
 */
export function detectQuad(src: HTMLCanvasElement | HTMLVideoElement, work = 480): { quad: Quad | null; coverage: number } {
  const sw = src instanceof HTMLVideoElement ? src.videoWidth : src.width;
  const sh = src instanceof HTMLVideoElement ? src.videoHeight : src.height;
  if (!sw || !sh) return { quad: null, coverage: 0 };
  const k = work / Math.max(sw, sh);
  const w = Math.max(8, Math.round(sw * k)), h = Math.max(8, Math.round(sh * k));
  const c = scaleCanvas(src, w, h);
  const d = ctx2d(c).getImageData(0, 0, w, h).data;
  const n = w * h;
  const gray = new Uint8Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const v = Math.min(d[p], d[p + 1], d[p + 2]);
    gray[i] = v;
    hist[v]++;
  }
  const thr = otsu(hist, n);
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = gray[i] > thr ? 1 : 0;

  // крупнейшая связная компонента (4-связность, итеративный обход)
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  let bestSize = 0, bestStart = -1;
  for (let s = 0; s < n; s++) {
    if (!mask[s] || seen[s]) continue;
    let sp = 0, size = 0;
    stack[sp++] = s; seen[s] = 1;
    while (sp) {
      const i = stack[--sp];
      size++;
      const x = i % w;
      if (x > 0 && mask[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack[sp++] = i - 1; }
      if (x < w - 1 && mask[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack[sp++] = i + 1; }
      if (i >= w && mask[i - w] && !seen[i - w]) { seen[i - w] = 1; stack[sp++] = i - w; }
      if (i < n - w && mask[i + w] && !seen[i + w]) { seen[i + w] = 1; stack[sp++] = i + w; }
    }
    if (size > bestSize) { bestSize = size; bestStart = s; }
  }
  if (bestStart < 0 || bestSize < n * 0.12) return { quad: null, coverage: bestSize / n };

  // второй проход: собрать пиксели лучшей компоненты и найти экстремумы
  const comp = new Uint8Array(n);
  let sp = 0;
  stack[sp++] = bestStart; comp[bestStart] = 1;
  let tl: Pt = { x: 0, y: 0 }, br = tl, tr = tl, bl = tl;
  let minS = Infinity, maxS = -Infinity, minD = Infinity, maxD = -Infinity;
  while (sp) {
    const i = stack[--sp];
    const x = i % w, y = (i / w) | 0;
    const s1 = x + y, d1 = x - y;
    if (s1 < minS) { minS = s1; tl = { x, y }; }
    if (s1 > maxS) { maxS = s1; br = { x, y }; }
    if (d1 > maxD) { maxD = d1; tr = { x, y }; }
    if (d1 < minD) { minD = d1; bl = { x, y }; }
    if (x > 0 && mask[i - 1] && !comp[i - 1]) { comp[i - 1] = 1; stack[sp++] = i - 1; }
    if (x < w - 1 && mask[i + 1] && !comp[i + 1]) { comp[i + 1] = 1; stack[sp++] = i + 1; }
    if (i >= w && mask[i - w] && !comp[i - w]) { comp[i - w] = 1; stack[sp++] = i - w; }
    if (i < n - w && mask[i + w] && !comp[i + w]) { comp[i + w] = 1; stack[sp++] = i + w; }
  }
  const quadW: Quad = [tl, tr, br, bl];
  const area = polyArea(quadW);
  if (area < bestSize * 0.6 || area < n * 0.12) return { quad: null, coverage: area / n };
  const up = (p: Pt): Pt => ({ x: p.x / k, y: p.y / k });
  return { quad: [up(tl), up(tr), up(br), up(bl)], coverage: area / n };
}

/** Прямоугольник с небольшим отступом — когда лист не найден автоматически */
export function defaultQuad(w: number, h: number, inset = 0.04): Quad {
  const x0 = w * inset, x1 = w * (1 - inset), y0 = h * inset, y1 = h * (1 - inset);
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}

/* ───────── Перспектива ───────── */

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function solveHomography(dst: Pt[], src: Pt[]): number[] {
  // отображение dst(u,v) -> src(x,y): 8 неизвестных (a..h), h33 = 1
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = dst[i];
    const { x, y } = src[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x]);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y, y]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const pv = A[c][c] || 1e-12;
    for (let j = c; j < 9; j++) A[c][j] /= pv;
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c];
      if (!f) continue;
      for (let j = c; j < 9; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((r) => r[8]);
}

/**
 * Выпрямляет лист по четырём углам. Размер выхода подбирается так, чтобы короткая сторона была
 * не меньше ~1600 px (для OCR), а длинная — не больше ~3400 px.
 */
export function warpToRect(src: HTMLCanvasElement, quad: Quad): HTMLCanvasElement {
  const [tl, tr, br, bl] = quad;
  let w = Math.max(dist(tl, tr), dist(bl, br));
  let h = Math.max(dist(tl, bl), dist(tr, br));
  let s = 1;
  const short = Math.min(w, h), long = Math.max(w, h);
  if (short < 1600) s = Math.min(1600 / short, 3400 / long);
  if (long * s > 3400) s = 3400 / long;
  w = Math.max(16, Math.round(w * s));
  h = Math.max(16, Math.round(h * s));

  const H = solveHomography([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], quad);
  const sd = ctx2d(src).getImageData(0, 0, src.width, src.height);
  const S = sd.data, sw = src.width, sh = src.height;
  const out = makeCanvas(w, h);
  const g = ctx2d(out);
  const od = g.createImageData(w, h);
  const O = od.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const den = H[6] * x + H[7] * y + 1;
      const sx = (H[0] * x + H[1] * y + H[2]) / den;
      const sy = (H[3] * x + H[4] * y + H[5]) / den;
      const o = (y * w + x) * 4;
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) { O[o] = O[o + 1] = O[o + 2] = 255; O[o + 3] = 255; continue; }
      const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      for (let c = 0; c < 3; c++) {
        const top = S[i00 + c] * (1 - fx) + S[i10 + c] * fx;
        const bot = S[i01 + c] * (1 - fx) + S[i11 + c] * fx;
        O[o + c] = top * (1 - fy) + bot * fy;
      }
      O[o + 3] = 255;
    }
  }
  g.putImageData(od, 0, 0);
  return out;
}

/* ───────── Улучшение читаемости ───────── */

function integral(a: Float32Array | Uint8ClampedArray, w: number, h: number): Float64Array {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let row = 0;
    for (let x = 1; x <= w; x++) {
      row += a[(y - 1) * w + (x - 1)];
      I[y * (w + 1) + x] = I[(y - 1) * (w + 1) + x] + row;
    }
  }
  return I;
}
function boxMean(I: Float64Array, w: number, h: number, r: number): Float32Array {
  const out = new Float32Array(w * h);
  const W = w + 1;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const s = I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0];
      out[y * w + x] = s / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

export function toGray(c: HTMLCanvasElement): Uint8ClampedArray {
  const d = ctx2d(c).getImageData(0, 0, c.width, c.height).data;
  const g = new Uint8ClampedArray(c.width * c.height);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
  return g;
}

export function grayToCanvas(g: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const cx = ctx2d(c);
  const im = cx.createImageData(w, h);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) { im.data[p] = im.data[p + 1] = im.data[p + 2] = g[i]; im.data[p + 3] = 255; }
  cx.putImageData(im, 0, 0);
  return c;
}

/**
 * Выравнивание освещения (деление на фон), растяжение контраста и мягкое повышение резкости.
 * Возвращает серое изображение: тени и неравномерный свет не мешают OCR.
 */
export function enhance(c: HTMLCanvasElement): { canvas: HTMLCanvasElement; shadow: number } {
  const w = c.width, h = c.height;
  const gray = toGray(c);
  const I = integral(gray, w, h);
  const r = Math.max(12, Math.round(Math.min(w, h) / 22));
  const bg = boxMean(I, w, h, r);

  // тень: отношение самого тёмного и самого светлого участка фона (по крупной сетке)
  let bgMin = Infinity, bgMax = 0;
  const step = Math.max(8, Math.round(Math.min(w, h) / 12));
  for (let y = step; y < h - step; y += step) for (let x = step; x < w - step; x += step) {
    const v = bg[y * w + x];
    if (v < bgMin) bgMin = v;
    if (v > bgMax) bgMax = v;
  }
  const shadow = bgMax > 0 ? bgMin / bgMax : 1;

  const norm = new Float32Array(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0; i < norm.length; i++) {
    const v = Math.min(255, (gray[i] / Math.max(24, bg[i])) * 238);
    norm[i] = v;
    hist[v | 0]++;
  }
  // растяжение по 0.5% / 99.5% перцентилям
  const total = norm.length;
  let acc = 0, lo = 0, hi = 255;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= total * 0.005) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= total * 0.005) { hi = i; break; } }
  if (hi - lo < 40) { lo = 0; hi = 255; }
  const stretched = new Float32Array(w * h);
  for (let i = 0; i < stretched.length; i++) stretched[i] = Math.max(0, Math.min(255, ((norm[i] - lo) / (hi - lo)) * 255));

  // unsharp mask 3×3
  const I2 = integral(stretched, w, h);
  const blur = boxMean(I2, w, h, 1);
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < out.length; i++) out[i] = stretched[i] + 0.7 * (stretched[i] - blur[i]);
  return { canvas: grayToCanvas(out, w, h), shadow };
}

/* ───────── Оценка качества ───────── */

/** Резкость: дисперсия лапласиана, нормированная на дисперсию яркости (не зависит от экспозиции) */
export function sharpnessOf(gray: Uint8ClampedArray, w: number, h: number): number {
  let sum = 0, sum2 = 0;
  for (let i = 0; i < gray.length; i++) { sum += gray[i]; sum2 += gray[i] * gray[i]; }
  const mean = sum / gray.length;
  const variance = Math.max(1, sum2 / gray.length - mean * mean);
  let ls = 0, ls2 = 0, cnt = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const l = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
    ls += l; ls2 += l * l; cnt++;
  }
  const lm = ls / cnt;
  return (ls2 / cnt - lm * lm) / variance;
}

export function assessQuality(raw: HTMLCanvasElement, rectified: HTMLCanvasElement, enhancedShadow: number, quadCoverage: number): QualityReport {
  const k = 900 / Math.max(rectified.width, rectified.height);
  const small = scaleCanvas(rectified, rectified.width * k, rectified.height * k);
  const g = toGray(small);
  const sharpness = sharpnessOf(g, small.width, small.height);

  let sum = 0;
  for (let i = 0; i < g.length; i++) sum += g[i];
  const brightness = sum / g.length;

  // блики: плоские пересвеченные блоки 12×12
  const bs = 12;
  let flat = 0, blocks = 0;
  const rc = scaleCanvas(raw, Math.min(raw.width, 600), Math.min(raw.width, 600) * (raw.height / raw.width));
  const rg = toGray(rc);
  for (let by = 0; by + bs <= rc.height; by += bs) for (let bx = 0; bx + bs <= rc.width; bx += bs) {
    let s = 0, s2 = 0;
    for (let y = 0; y < bs; y++) for (let x = 0; x < bs; x++) { const v = rg[(by + y) * rc.width + bx + x]; s += v; s2 += v * v; }
    const m = s / (bs * bs), sd = Math.sqrt(Math.max(0, s2 / (bs * bs) - m * m));
    blocks++;
    if (m >= 249 && sd < 3) flat++;
  }
  const glare = blocks ? flat / blocks : 0;

  const issues: QualityIssue[] = [];
  if (sharpness < 0.05) issues.push({ code: "blur", level: "bad", text: "Снимок размыт — держите телефон ровно и дождитесь фокусировки" });
  else if (sharpness < 0.12) issues.push({ code: "blur", level: "warn", text: "Текст немного нечёткий" });
  const rawMean = (() => { let s = 0; for (let i = 0; i < rg.length; i++) s += rg[i]; return s / rg.length; })();
  if (rawMean < 70) issues.push({ code: "dark", level: "bad", text: "Слишком темно — включите вспышку или добавьте свет" });
  else if (rawMean < 105) issues.push({ code: "dark", level: "warn", text: "Освещения немного не хватает" });
  if (rawMean > 245) issues.push({ code: "bright", level: "warn", text: "Снимок пересвечен" });
  if (glare > 0.12) issues.push({ code: "glare", level: "bad", text: "Сильные блики на бумаге — измените угол съёмки" });
  else if (glare > 0.05) issues.push({ code: "glare", level: "warn", text: "Есть блики на бумаге" });
  if (enhancedShadow < 0.5) issues.push({ code: "shadow", level: "bad", text: "Тень закрывает часть листа" });
  else if (enhancedShadow < 0.7) issues.push({ code: "shadow", level: "warn", text: "На листе есть тень" });
  if (quadCoverage > 0 && quadCoverage < 0.3) issues.push({ code: "small", level: "warn", text: "Лист занимает мало места — подойдите ближе" });

  const level = issues.some((i) => i.level === "bad") ? "bad" : issues.length ? "warn" : "good";
  return { sharpness, brightness, glare, shadow: enhancedShadow, issues, level };
}

/** Быстрая оценка для живого предпросмотра камеры */
export function liveQuality(video: HTMLVideoElement): { sharp: number; mean: number } {
  const w = 320, h = Math.round((video.videoHeight / video.videoWidth) * w) || 240;
  const c = scaleCanvas(video, w, h);
  const g = toGray(c);
  let s = 0;
  for (let i = 0; i < g.length; i++) s += g[i];
  return { sharp: sharpnessOf(g, w, h), mean: s / g.length };
}
