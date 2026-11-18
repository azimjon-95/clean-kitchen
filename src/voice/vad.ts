/**
 * Отсечение шума и далёкой речи (чистые функции, без DOM — тестируются в Node).
 *
 * Идея: автоусиление микрофона ВЫКЛЮЧЕНО, поэтому речь рядом с телефоном заметно громче,
 * чем голоса на расстоянии. Мы:
 *  1. считаем энергию кадров (дБ), оцениваем уровень шума (нижний перцентиль);
 *  2. находим сегменты речи (энергия выше шума на SNR_MIN дБ и выше абсолютного порога);
 *  3. оставляем только сегмент(ы) ближнего говорящего — самые громкие; сегменты тише
 *     лучшего на NEAR_MARGIN_DB считаются «далёкими» и отбрасываются;
 *  4. обрезаем запись по границам речи (+небольшой запас).
 */

export const FRAME_MS = 20;
export const SNR_MIN_DB = 12;        // речь должна быть выше шума минимум на 12 дБ
export const ABS_MIN_DB = -50;       // и не тише -50 dBFS (иначе «шёпот издалека»)
export const NEAR_MARGIN_DB = 9;     // сегменты тише лучшего больше чем на 9 дБ — далёкие голоса
export const MIN_SPEECH_MS = 260;
export const HANG_MS = 280;          // пауза внутри фразы, которую не считаем концом
export const END_SILENCE_MS = 850;   // тишина после речи → конец фразы
export const PAD_MS = 160;

export type Segment = { start: number; end: number; meanDb: number; peakDb: number }; // индексы кадров
export type Analysis = {
  ok: boolean;
  reason?: "silence" | "too-quiet" | "too-short" | "noisy";
  noiseDb: number;
  snrDb: number;
  speechMs: number;
  segments: Segment[];
  kept?: Segment;
  droppedFar: number;               // сколько далёких сегментов отброшено
  range?: [number, number];         // диапазон сэмплов для обрезки
};

export function frameDb(pcm: Float32Array, sampleRate: number): Float32Array {
  const n = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1000));
  const frames = Math.floor(pcm.length / n);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    for (let i = f * n; i < (f + 1) * n; i++) s += pcm[i] * pcm[i];
    out[f] = 10 * Math.log10(s / n + 1e-10);
  }
  return out;
}

const percentile = (a: Float32Array, p: number) => {
  const s = Array.from(a).sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? -100;
};

export function analyze(pcm: Float32Array, sampleRate: number): Analysis {
  const db = frameDb(pcm, sampleRate);
  const frameSamples = Math.round((sampleRate * FRAME_MS) / 1000);
  if (db.length < 10) return { ok: false, reason: "too-short", noiseDb: -100, snrDb: 0, speechMs: 0, segments: [], droppedFar: 0 };

  const noiseDb = percentile(db, 0.15);
  const thr = Math.max(noiseDb + SNR_MIN_DB, ABS_MIN_DB);

  // сегменты с «зависанием» (hang) внутри фразы
  const hang = Math.round(HANG_MS / FRAME_MS);
  const segs: Segment[] = [];
  let start = -1, last = -1;
  for (let f = 0; f < db.length; f++) {
    if (db[f] > thr) { if (start < 0) start = f; last = f; }
    else if (start >= 0 && f - last > hang) { segs.push(mk(db, start, last)); start = -1; }
  }
  if (start >= 0) segs.push(mk(db, start, last));
  const minF = Math.round(MIN_SPEECH_MS / FRAME_MS);
  const speech = segs.filter((s) => s.end - s.start + 1 >= minF);

  const peakAll = db.reduce((m, v) => Math.max(m, v), -100);
  if (!speech.length) {
    return { ok: false, reason: peakAll < ABS_MIN_DB ? "too-quiet" : peakAll - noiseDb < SNR_MIN_DB ? "silence" : "too-short",
      noiseDb, snrDb: peakAll - noiseDb, speechMs: 0, segments: segs, droppedFar: 0 };
  }

  const best = speech.reduce((a, b) => (b.meanDb > a.meanDb ? b : a));
  const near = speech.filter((s) => s.meanDb >= best.meanDb - NEAR_MARGIN_DB);
  const droppedFar = speech.length - near.length;
  // Диапазон: от первого до последнего ближнего сегмента (пауза между ними внутри фразы сохраняется)
  const first = near[0], lastSeg = near[near.length - 1];
  const pad = Math.round(PAD_MS / FRAME_MS);
  const a = Math.max(0, first.start - pad) * frameSamples;
  const b = Math.min(db.length, lastSeg.end + 1 + pad) * frameSamples;
  const speechMs = near.reduce((m, s) => m + (s.end - s.start + 1) * FRAME_MS, 0);
  return { ok: true, noiseDb, snrDb: best.meanDb - noiseDb, speechMs, segments: speech, kept: best, droppedFar, range: [a, b] };
}

function mk(db: Float32Array, start: number, end: number): Segment {
  let s = 0, p = -100;
  for (let i = start; i <= end; i++) { s += db[i]; p = Math.max(p, db[i]); }
  return { start, end, meanDb: s / (end - start + 1), peakDb: p };
}

/** Живой эндпоинтер: сообщает, когда фраза закончена (после речи прошла тишина) */
export class Endpointer {
  private noise: number[] = [];
  private noiseDb = -60;
  private speechFrames = 0;
  private silenceFrames = 0;
  private frames = 0;
  state: "idle" | "speech" | "done" = "idle";
  level = -100;

  push(frameDbValue: number): "idle" | "speech" | "done" {
    this.frames++; this.level = frameDbValue;
    // первые ~400 мс — калибровка шума (пользователь ещё не начал говорить)
    if (this.frames <= 20) { this.noise.push(frameDbValue); this.noiseDb = Math.min(...this.noise.slice(-20)) ; return this.state; }
    const thr = Math.max(this.noiseDb + SNR_MIN_DB, ABS_MIN_DB);
    if (frameDbValue > thr) {
      this.speechFrames++; this.silenceFrames = 0;
      if (this.speechFrames >= Math.round(MIN_SPEECH_MS / FRAME_MS)) this.state = "speech";
    } else if (this.state === "speech") {
      if (++this.silenceFrames >= Math.round(END_SILENCE_MS / FRAME_MS)) this.state = "done";
    } else if (!this.noise.length || frameDbValue < this.noiseDb + 3) {
      // дрейф шума в тишине
      this.noiseDb = 0.98 * this.noiseDb + 0.02 * frameDbValue;
    }
    return this.state;
  }
}
