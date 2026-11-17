/**
 * Поиск линий таблицы на выровненной странице (серое изображение).
 * Сначала вертикальные линии (длинные тёмные отрезки), затем горизонтальные внутри таблицы.
 */
export type Grid = { xs: number[]; ys: number[]; bbox: [number, number, number, number] | null };

function groupLines(idx: number[], gap = 4): number[] {
  const out: number[] = [];
  let start = -1, prev = -100;
  const flush = (e: number) => { if (start >= 0) out.push(Math.round((start + e) / 2)); };
  for (const i of idx) {
    if (i - prev > gap) { flush(prev); start = i; }
    prev = i;
  }
  flush(prev);
  return out;
}

const DARK = 195;
const GAP = 4;

export function detectGrid(gray: Uint8ClampedArray, w: number, h: number): Grid {
  // вертикальные: самый длинный тёмный отрезок в каждом столбце
  const vIdx: number[] = [];
  const vS = new Int32Array(w), vE = new Int32Array(w), vL = new Int32Array(w);
  const mx = Math.round(w * 0.025), my = Math.round(h * 0.02); // края листа/тени не считаем линиями
  for (let x = mx; x < w - mx; x++) {
    let run = 0, gap = 0, best = 0, cs = 0, bs = 0, be = 0;
    for (let y = my; y < h - my; y++) {
      if (gray[y * w + x] < DARK) {
        if (run === 0) cs = y;
        run += 1 + gap; gap = 0;
        if (run > best) { best = run; bs = cs; be = y; }
      } else if (run > 0 && ++gap > GAP) { run = 0; gap = 0; }
    }
    vS[x] = bs; vE[x] = be; vL[x] = best;
  }
  let maxL = 0;
  for (let x = 0; x < w; x++) if (vL[x] > maxL) maxL = vL[x];
  // линии основной таблицы — самые длинные; рамки меньших блоков (технология) отбрасываются
  for (let x = 0; x < w; x++) if (vL[x] >= Math.max(h * 0.12, maxL * 0.45)) vIdx.push(x);
  if (vIdx.length < 2) return { xs: [], ys: [], bbox: null };
  const xs = groupLines(vIdx);
  // вертикальный диапазон таблицы — по самым длинным линиям
  let y0 = Infinity, y1 = 0;
  for (const x of vIdx) { y0 = Math.min(y0, vS[x]); y1 = Math.max(y1, vE[x]); }
  const x0 = xs[0], x1 = xs[xs.length - 1];

  // горизонтальные внутри [x0,x1]
  const hIdx: number[] = [];
  const need = (x1 - x0) * 0.35;
  for (let y = Math.max(0, y0 - 6); y <= Math.min(h - 1, y1 + 6); y++) {
    let run = 0, gap = 0, best = 0;
    for (let x = x0; x <= x1; x++) {
      if (gray[y * w + x] < DARK) { run += 1 + gap; gap = 0; if (run > best) best = run; }
      else if (run > 0 && ++gap > GAP) { run = 0; gap = 0; }
    }
    if (best >= need) hIdx.push(y);
  }
  return { xs, ys: groupLines(hIdx), bbox: [x0, y0, x1, y1] };
}
