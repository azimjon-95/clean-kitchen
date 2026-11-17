/** Типы модуля Document Scanner */

export type Pt = { x: number; y: number };
/** Углы листа: левый-верхний, правый-верхний, правый-нижний, левый-нижний */
export type Quad = [Pt, Pt, Pt, Pt];

/**
 * Поле распознавания. `v` — ИСХОДНОЕ значение так, как оно прочитано (без округления и «исправлений»).
 * `c` — уверенность OCR 0..100, -1 — неизвестно. `edited` — пользователь подтвердил/исправил вручную.
 */
export type Field = { v: string; c: number; edited?: boolean; note?: string };

export type DocType = "tech" | "calc" | "both" | "unknown";
export const DOC_TYPE_LABEL: Record<DocType, string> = {
  tech: "Технологическая карта",
  calc: "Калькуляционная карта",
  both: "Технологическая и калькуляционная карта",
  unknown: "Неизвестный документ"
};

export type ColKey = "gross" | "net" | "cooked" | "netPortions" | "norm" | "price" | "sum" | "vat";
export const COL_LABEL: Record<ColKey, string> = {
  gross: "Брутто",
  net: "Нетто",
  cooked: "Готовый продукт",
  netPortions: "Нетто на порции",
  norm: "Норма расхода",
  price: "Закупочная цена",
  sum: "Сумма",
  vat: "НДС"
};

export type HeaderKey =
  | "org" | "venue" | "dish" | "cardNo" | "date" | "yield" | "basis"
  | "calcNo" | "portions" | "costPerPortion" | "costTotal" | "salePrice" | "markup" | "vatPurchase";
export const HEADER_LABEL: Record<HeaderKey, string> = {
  org: "Организация",
  venue: "Предприятие / ресторан",
  dish: "Название блюда",
  cardNo: "№ технологической карты",
  date: "Дата утверждения",
  yield: "Выход готового блюда",
  basis: "Основание производства",
  calcNo: "№ калькуляции",
  portions: "Количество порций",
  costPerPortion: "Себестоимость 1 порции",
  costTotal: "Себестоимость на все порции",
  salePrice: "Отпускная цена",
  markup: "Наценка, %",
  vatPurchase: "НДС закупки"
};

export type Rect = [number, number, number, number]; // x0,y0,x1,y1 в координатах выровненной страницы

export type Row = {
  id: string;
  page: number;
  n: Field;
  name: Field;
  unit: Field;
  cols: Partial<Record<ColKey, Field>>;
  /** Прямоугольник строки и ячеек на выровненной странице — для сравнения с оригиналом и повторного OCR */
  rect?: Rect;
  cells?: { n?: Rect; name?: Rect; unit?: Rect } & Partial<Record<ColKey, Rect>>;
};

export type PageData = {
  id: string;
  /** Исходное фото (jpeg) — сохраняется вместе с картой */
  original: Blob;
  /** Выровненная и улучшенная страница (для OCR и сравнения) */
  rectified: HTMLCanvasElement;
  thumb: string;
  quality: QualityReport;
};

export type QualityIssue = { code: "blur" | "dark" | "bright" | "glare" | "shadow" | "small" | "skew"; level: "warn" | "bad"; text: string };
export type QualityReport = {
  sharpness: number;
  brightness: number;
  glare: number;
  shadow: number;
  issues: QualityIssue[];
  level: "good" | "warn" | "bad";
};

export type ScanResult = {
  docType: DocType;
  header: Partial<Record<HeaderKey, Field>>;
  colKeys: ColKey[];
  colTitles: Partial<Record<ColKey, string>>;
  rows: Row[];
  totals: Partial<Record<ColKey, Field>>;
  tech: Field;
  signatures: string[];
  rawText: string;
  engine: string;
  ms: number;
  notes: string[];
};

export type Warning = { level: "warn" | "bad"; text: string; rowId?: string };
