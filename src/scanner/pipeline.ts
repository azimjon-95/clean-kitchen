/**
 * Разбор документа: тип карты → шапка → таблица (по линиям сетки, ячейка за ячейкой) → поля.
 * Ничего не придумывается: нечитаемое остаётся пустым или помечается красным.
 */
import type { OcrEngine, OcrLine } from "./engine";
import { detectGrid } from "./grid";
import { toGray } from "./imaging";
import { NUM_RE } from "./numbers";
import type { ColKey, DocType, Field, HeaderKey, PageData, Rect, Row, ScanResult } from "./types";

export type Progress = (pct: number, text: string) => void;

const fld = (v: string, c: number, note?: string): Field => ({ v, c: Math.round(c), ...(note ? { note } : {}) });
const UNITS = ["кг", "г", "л", "мл", "шт", "порц", "пучок", "уп", "мг", "см"];

/* ───────── Тип документа ───────── */
export function detectDocType(text: string): DocType {
  const t = text.toLowerCase().replace(/ё/g, "е");
  const tech = /технологическ[а-яё]*\s+карт/.test(t) || /технологи[а-яё]+\s+приготовлен/.test(t);
  const calc = /калькуляционн[а-яё]*\s+карт/.test(t) || /(себестоимост|закупочн[а-яё]+\s+цен|наценк)/.test(t);
  if (tech && calc) return "both";
  if (tech) return "tech";
  if (calc) return "calc";
  return "unknown";
}

/** Склейка слов в «визуальные» строки по координате Y — устойчиво к тому, как OCR режет блоки */
export function visualLines(lines: OcrLine[]): OcrLine[] {
  const words = lines.flatMap((l) => l.words).filter((w) => w.text.trim());
  if (!words.length) return lines;
  const hs = words.map((w) => w.bbox[3] - w.bbox[1]).sort((a, b) => a - b);
  const tol = Math.max(6, hs[Math.floor(hs.length / 2)] * 0.55);
  const sorted = words.slice().sort((a, b) => (a.bbox[1] + a.bbox[3]) - (b.bbox[1] + b.bbox[3]));
  const groups: typeof words[] = [];
  let cy = -1e9;
  for (const w of sorted) {
    const y = (w.bbox[1] + w.bbox[3]) / 2;
    if (groups.length && Math.abs(y - cy) <= tol) { const g = groups[groups.length - 1]; g.push(w); cy = (cy * (g.length - 1) + y) / g.length; }
    else { groups.push([w]); cy = y; }
  }
  return groups.map((g) => {
    g.sort((a, b) => a.bbox[0] - b.bbox[0]);
    const conf = g.reduce((a, w) => a + w.conf, 0) / g.length;
    return {
      text: g.map((w, i) => (i && w.bbox[0] - g[i - 1].bbox[2] > tol * 4 ? " ¦ " : i ? " " : "") + w.text).join(""), conf, words: g,
      bbox: [Math.min(...g.map((w) => w.bbox[0])), Math.min(...g.map((w) => w.bbox[1])), Math.max(...g.map((w) => w.bbox[2])), Math.max(...g.map((w) => w.bbox[3]))] as Rect
    };
  });
}

/* ───────── Шапка ───────── */
const HEADER_RULES: [HeaderKey, RegExp][] = [
  ["org", /^\s*орган[а-яё]*\s*[:.]?\s*(.+)$/i],
  ["venue", /^\s*(?:предпр[а-яё]*|ресторан|заведение)\s*[:.]?\s*(.+)$/i],
  ["dish", /наименов[а-яё]*\s+блюд[а-яё]*\s*[:.]?\s*(.+)$/i],
  ["yield", /выход[^:]*?(?:виде|блюда)?\s*[:.]\s*(.+)$/i],
  ["basis", /основани[а-яё]*\s+производств[а-яё]*\s*[:.]?\s*(.+)$/i],
  ["cardNo", /технологическ[а-яё]*\s+карт[а-яё]*\s*(?:№|N|no)\s*([\wа-яё\-./]+)/i],
  ["calcNo", /калькуляционн[а-яё]*\s+карт[а-яё]*\s*(?:№|N|no)\s*([\wа-яё\-./]+)/i],
  ["portions", /(?:количество\s+порций|порций)\s*[:.]?\s*(\d+)/i],
  ["costPerPortion", /себестоимост[а-яё]*\s+(?:1|одной)\s+порци[а-яё]*\s*[:.]?\s*([\d\s,.]+)/i],
  ["costTotal", /себестоимост[а-яё]*\s+(?:на\s+)?(?:все|всех)\s+порци[а-яё]*\s*[:.]?\s*([\d\s,.]+)/i],
  ["salePrice", /(?:отпускн[а-яё]+\s+цена|цена\s+продажи|цена\s+реализации)\s*[:.]?\s*([\d\s,.]+)/i],
  ["markup", /наценк[а-яё]*[^:\d]*[:.]?\s*([\d,.]+)\s*%?/i],
  ["vatPurchase", /ндс\s+закупк[а-яё]*\s*[:.]?\s*([\d,.]+\s*%?)/i]
];
const DATE_RE = /(?<![\d.])(\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2})(?![\d.])/;

function extractHeader(lines: OcrLine[], full: string): Partial<Record<HeaderKey, Field>> {
  const out: Partial<Record<HeaderKey, Field>> = {};
  for (const ln of lines) {
    const txt = ln.text.replace(/[_|]+/g, " ").replace(/\s+/g, " ").trim();
    const cutAt = (v: string) => (v.split("¦").map((x) => x.trim()).find(Boolean) ?? "");
    if (!txt) continue;
    for (const [k, re] of HEADER_RULES) {
      if (out[k]) continue;
      const m = txt.match(re);
      if (m && m[1] && cutAt(m[1])) out[k] = fld(cutAt(m[1]).replace(/^[:.\s]+/, ""), ln.conf);
    }
  }
  const dm = full.match(DATE_RE);
  if (dm) out.date = fld(dm[1], 70);
  return out;
}

function extractTech(lines: OcrLine[]): string {
  const i = lines.findIndex((l) => /технологи[а-яё]+\s+приготовлен/i.test(l.text));
  if (i < 0) return "";
  const acc: string[] = [];
  for (let j = i + 1; j < lines.length; j++) {
    if (/^\s*(директор|шеф|калькулятор|составил|руководитель|технолог\s*[_:.\s])/i.test(lines[j].text)) break;
    acc.push(lines[j].text.replace(/¦/g, " ").trim());
  }
  return acc.filter(Boolean).join("\n");
}

const SURNAME_RE = /[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.\s?[А-ЯЁ]\./g;
const extractSignatures = (text: string): string[] => Array.from(new Set(text.match(SURNAME_RE) ?? []));

/* ───────── Колонки ───────── */
export function mapColumn(title: string): ColKey | "n" | "name" | "unit" | null {
  const t = title.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
  if (!t.trim()) return null;
  if (/^[n№н#]\s*(?:п\/п)?$/.test(t.trim()) || t.includes("№")) return "n";
  if (/наименован|продукт|сырь|ингредиент/.test(t) && !/готов/.test(t)) return "name";
  if (/^ед|изм/.test(t)) return "unit";
  if (/брутто/.test(t)) return "gross";
  if (/готов/.test(t)) return "cooked";
  if (/нетто/.test(t) && /(на\s*\d|порц|шт)/.test(t)) return "netPortions";
  if (/нетто/.test(t)) return "net";
  if (/норм/.test(t)) return "norm";
  if (/цен/.test(t)) return "price";
  if (/сумм|стоимост/.test(t)) return "sum";
  if (/ндс/.test(t)) return "vat";
  return null;
}

/* ───────── Чтение чисел ───────── */
async function readNumber(engine: OcrEngine, page: HTMLCanvasElement, rect: Rect): Promise<Field> {
  // проход A: только цифры и запятая (в русских документах десятичный разделитель — запятая)
  const a = await engine.recognize(page, { rect, mode: "line", whitelist: "0123456789," });
  let text = a.text.replace(/\s+/g, "");
  let conf = a.conf;
  let note: string | undefined;

  if (!text || conf < 80 || !/,/.test(text)) {
    // повторный OCR только этой ячейки: увеличение ×3, допустимы цифры и запятая
    const c = await engine.recognize(page, { rect, mode: "line", whitelist: "0123456789,", upscale: 3 });
    const ct = c.text.replace(/\s+/g, "").replace(/^[,.]+|[,.]+$/g, "");
    if (/^\d+,\d+$/.test(ct) && (c.conf >= conf - 3 || !/,/.test(text))) { text = ct; conf = Math.max(c.conf, conf); }
  }
  if (!text || conf < 80 || !/,/.test(text)) {
    // последний проход: допускаем точку; результат всегда помечается для проверки
    const b = await engine.recognize(page, { rect, mode: "line", whitelist: "0123456789,.", upscale: 2.5 });
    const bt = b.text.replace(/\s+/g, "").replace(/^[,.]+|[,.]+$/g, "");
    if (bt && (!text || b.conf >= conf - 2)) {
      if (bt.replace(/[.,]/g, "") === text.replace(/[.,]/g, "") || !text) {
        if (/\./.test(bt) && !/,/.test(text)) { note = "В документе распознана точка вместо запятой — проверьте"; conf = Math.min(b.conf, 74); }
        else conf = Math.max(conf, b.conf);
        text = bt;
      } else {
        text = bt; conf = Math.min(b.conf, conf);
        note = "Результаты проходов OCR различаются — проверьте";
      }
    }
  }
  text = text.replace(/^[,.]+|[,.]+$/g, (m) => (note = "Лишний знак по краям убран — проверьте", ""));
  if (!text) return fld("", -1, "Ячейка пуста или нечитаема");
  // LSTM-движок не всегда соблюдает список допустимых символов: точка вместо запятой всегда помечается
  if (/\./.test(text) && !note) { note = "В числе точка вместо запятой — проверьте и исправьте при необходимости"; conf = Math.min(conf, 74); }
  if (!NUM_RE.test(text)) return fld(text, Math.min(conf, 30), "Значение не похоже на число");
  if (!/[.,]/.test(text) && text.length >= 3 && text.startsWith("0")) {
    return fld(text, Math.min(conf, 40), "Не найден разделитель — число не изменено, исправьте вручную");
  }
  return fld(text, conf, note);
}

async function readText(engine: OcrEngine, page: HTMLCanvasElement, rect: Rect, mode: "block" | "line" = "block"): Promise<Field> {
  const r = await engine.recognize(page, { rect, mode });
  const v = r.text.replace(/\s*\n\s*/g, " ").trim();
  return fld(v, v ? r.conf : -1);
}

async function readUnit(engine: OcrEngine, page: HTMLCanvasElement, rect: Rect): Promise<Field> {
  const r = await engine.recognize(page, { rect, mode: "line" });
  const raw = r.text.trim();
  const low = raw.toLowerCase().replace(/[.\s]/g, "");
  if (UNITS.includes(low)) return fld(low, Math.max(r.conf, 88));
  if (!raw) return fld("", -1);
  return fld(raw, Math.min(r.conf, 55), "Единица измерения не опознана");
}

/* ───────── Таблица ───────── */
type TableOut = { colKeys: ColKey[]; colTitles: Partial<Record<ColKey, string>>; rows: Row[]; totals: Partial<Record<ColKey, Field>>; notes: string[] };

async function extractTable(engine: OcrEngine, page: HTMLCanvasElement, pageNo: number, onP: Progress): Promise<TableOut | null> {
  const gray = toGray(page);
  const grid = detectGrid(gray, page.width, page.height);
  const { xs, ys } = grid;
  if (xs.length < 4 || ys.length < 3) return null;
  const nC = xs.length - 1;
  const pad = 5;
  const cell = (r: number, c: number): Rect => [xs[c] + pad, ys[r] + pad, xs[c + 1] - pad, ys[r + 1] - pad];

  // заголовки столбцов
  const keys: (ColKey | "n" | "name" | "unit" | null)[] = [];
  const titles: string[] = [];
  for (let c = 0; c < nC; c++) {
    const t = await readText(engine, page, cell(0, c));
    titles.push(t.v);
    keys.push(mapColumn(t.v));
  }
  // запасное отображение по позиции
  if (keys[0] == null) keys[0] = "n";
  if (keys[1] == null) keys[1] = "name";
  if (keys[2] == null) keys[2] = "unit";
  const fallback: ColKey[] = ["gross", "net", "cooked", "netPortions"];
  let fi = 0;
  for (let c = 3; c < nC; c++) if (keys[c] == null) { while (fi < fallback.length && keys.includes(fallback[fi])) fi++; keys[c] = fallback[fi++] ?? null; }

  const colKeys = keys.filter((k): k is ColKey => !!k && !["n", "name", "unit"].includes(k));
  const colTitles: Partial<Record<ColKey, string>> = {};
  keys.forEach((k, c) => { if (k && !["n", "name", "unit"].includes(k)) colTitles[k as ColKey] = titles[c]; });
  const idx = (k: string) => keys.indexOf(k as any);

  const rows: Row[] = [];
  let totals: Partial<Record<ColKey, Field>> = {};
  const notes: string[] = [];
  const bands = ys.length - 1;
  for (let r = 1; r < bands; r++) {
    onP(r / bands, `Таблица: строка ${r} из ${bands - 1}`);
    const nCol = idx("n"), nameCol = idx("name"), unitCol = idx("unit");
    const nF = nCol >= 0 ? await readText(engine, page, cell(r, nCol), "line") : fld("", -1);
    const nameF = nameCol >= 0 ? await readText(engine, page, cell(r, nameCol)) : fld("", -1);
    const cols: Partial<Record<ColKey, Field>> = {};
    for (const k of colKeys) cols[k] = await readNumber(engine, page, cell(r, idx(k)));
    const hasNum = colKeys.some((k) => cols[k]!.v);
    if (!hasNum && !nameF.v) continue; // пустая полоса

    const isTotal = !nameF.v && !/^\d+$/.test(nF.v) && hasNum;
    if (isTotal || (/итог/i.test(nameF.v) && hasNum)) { totals = cols; continue; }

    const unitF = unitCol >= 0 ? await readUnit(engine, page, cell(r, unitCol)) : fld("", -1);
    const rect: Rect = [xs[0], ys[r], xs[nC], ys[r + 1]];
    const cells: Row["cells"] = {};
    if (nCol >= 0) cells.n = cell(r, nCol);
    if (nameCol >= 0) cells.name = cell(r, nameCol);
    if (unitCol >= 0) cells.unit = cell(r, unitCol);
    for (const k of colKeys) cells[k] = cell(r, idx(k));
    rows.push({ id: `p${pageNo}r${r}`, page: pageNo, n: nF, name: nameF, unit: unitF, cols, rect, cells });
  }
  return { colKeys, colTitles, rows, totals, notes };
}

/* ───────── Запасной вариант без линий (строки текста) ───────── */
function tableFromLines(lines: OcrLine[], pageNo: number): TableOut | null {
  const rows: Row[] = [];
  const re = /^\s*(\d{1,3})[.)\s]+(.+?)\s+(кг|г|л|мл|шт|порц)\s+((?:\d+[.,]\d+\s*)+)$/i;
  for (const ln of lines) {
    const m = ln.text.replace(/¦/g, " ").replace(/\s+/g, " ").match(re);
    if (!m) continue;
    const nums = m[4].trim().split(/\s+/);
    const keys: ColKey[] = ["gross", "net", "cooked", "netPortions"];
    const cols: Partial<Record<ColKey, Field>> = {};
    nums.slice(0, 4).forEach((v, i) => (cols[keys[i]] = fld(v, Math.min(ln.conf, 70), "Таблица без линий — проверьте")));
    rows.push({ id: `p${pageNo}l${rows.length}`, page: pageNo, n: fld(m[1], ln.conf), name: fld(m[2].trim(), ln.conf), unit: fld(m[3].toLowerCase(), ln.conf), cols, rect: ln.bbox });
  }
  if (!rows.length) return null;
  const colKeys = (["gross", "net", "cooked", "netPortions"] as ColKey[]).filter((k) => rows.some((r) => r.cols[k]));
  return { colKeys, colTitles: {}, rows, totals: {}, notes: ["Линии таблицы не найдены — строки собраны из текста, проверьте каждую"] };
}

/* ───────── Главная функция ───────── */
export async function analyzePages(pages: PageData[], engine: OcrEngine, onProgress: Progress = () => {}): Promise<ScanResult> {
  const t0 = performance.now();
  await engine.init((p, s) => onProgress(0, s === "loading language traineddata" ? "Загрузка языковой модели…" : "Подготовка OCR…"));
  let header: ScanResult["header"] = {};
  let rawText = "";
  let tech = "";
  let rows: Row[] = [];
  let colKeys: ColKey[] = [];
  let colTitles: ScanResult["colTitles"] = {};
  let totals: ScanResult["totals"] = {};
  const notes: string[] = [];
  const allLines: OcrLine[] = [];

  for (let pi = 0; pi < pages.length; pi++) {
    const pg = pages[pi].rectified;
    const base = pi / pages.length, span = 1 / pages.length;
    onProgress(base, `Страница ${pi + 1}: чтение текста…`);
    const full = await engine.recognize(pg, { mode: "page" });
    const vl = visualLines(full.lines);
    const vtext = vl.map((l) => l.text).join("\n");
    rawText += (rawText ? "\n" : "") + full.text + "\n" + vtext;
    allLines.push(...vl);
    const h = extractHeader(vl, vtext);
    for (const k of Object.keys(h) as HeaderKey[]) if (!header[k]) header[k] = h[k];
    const tx = extractTech(vl);
    if (tx) tech += (tech ? "\n" : "") + tx;

    onProgress(base + span * 0.2, `Страница ${pi + 1}: таблица…`);
    let tb = await extractTable(engine, pg, pi, (p, t) => onProgress(base + span * (0.2 + 0.8 * p), t));
    if (!tb) tb = tableFromLines(vl, pi);
    if (tb) {
      for (const r of tb.rows) rows.push(r);
      for (const k of tb.colKeys) if (!colKeys.includes(k)) colKeys.push(k);
      colTitles = { ...colTitles, ...tb.colTitles };
      if (Object.keys(tb.totals).length) totals = tb.totals;
      notes.push(...tb.notes);
    } else notes.push(`Страница ${pi + 1}: таблица не найдена`);
  }
  // нумерация: если строки одной страницы без номеров — не придумываем
  const docType = detectDocType(rawText);
  if (docType === "unknown") notes.push("Тип документа не определён — это не технологическая и не калькуляционная карта, либо текст не читается");
  const sig = extractSignatures(rawText);
  onProgress(1, "Готово");
  return {
    docType, header, colKeys, colTitles, rows, totals,
    tech: fld(tech, tech ? 70 : -1), signatures: sig, rawText,
    engine: engine.name, ms: Math.round(performance.now() - t0), notes
  };
}

/** Повторное чтение одной проблемной ячейки (с увеличением) */
export async function rereadCell(engine: OcrEngine, page: HTMLCanvasElement, rect: Rect, kind: "num" | "text" | "unit"): Promise<Field> {
  if (kind === "num") return readNumber(engine, page, rect);
  if (kind === "unit") return readUnit(engine, page, rect);
  const r = await engine.recognize(page, { rect, mode: "block", upscale: 2 });
  const v = r.text.replace(/\s*\n\s*/g, " ").trim();
  return fld(v, v ? r.conf : -1);
}
