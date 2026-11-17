export type CostLine = {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  total: number;
};

export type RecipeCost = {
  total: number;
  perPortion: number | null;
  portions: number | null;
  complete: boolean;
  lines?: CostLine[];
};

export type Ingredient = {
  name: string;
  amount: string;
  quantity?: number;
  unit?: string;
  /** Исходные значения документа — ровно так, как напечатаны (строки, запятая сохранена) */
  original?: {
    n?: string; name: string; unit?: string;
    gross?: string; net?: string; cooked?: string; netPortions?: string;
    norm?: string; price?: string; sum?: string; vat?: string;
  };
  /** Значения, вычисленные приложением (отдельно от исходных) */
  computedSum?: string;
};

/** Данные импорта из документа (OCR): исходные поля сохраняются неизменными */
export type ScanMeta = {
  importId: string;
  docType: "tech" | "calc" | "both" | "unknown";
  engine: string;
  confirmedAt: string;
  header: Record<string, string>;
  colTitles: Record<string, string>;
  totals: Record<string, string>;
  computedTotals: Record<string, string>;
  signatures: string[];
  warnings: string[];
  pages: number;
};

export type Recipe = {
  id: string;
  name: string;
  category: string;
  yield: string;
  time: string;
  description: string;
  ingredients: Ingredient[];
  steps: string[];
  stepImages?: string[];
  tags: string[];
  imageUrl?: string;
  popular?: boolean;
  cost?: RecipeCost;
  costCurrency?: string;
  portionCount?: number;
  yieldQuantity?: number;
  yieldUnit?: string;
  department?: string;
  section?: string;
  version?: number;
  updatedAt?: string;
  /** Есть только у карточек, импортированных из документа */
  scan?: ScanMeta;
};

/** Ma'lumot manbasi: server, IndexedDB kesh yoki mock (demo). */
export type DataSource = "loading" | "server" | "cache" | "mock";
