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
};

/** Ma'lumot manbasi: server, IndexedDB kesh yoki mock (demo). */
export type DataSource = "loading" | "server" | "cache" | "mock";
