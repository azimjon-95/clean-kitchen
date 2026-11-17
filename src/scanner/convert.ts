import type { Ingredient, Recipe, RecipeCost, CostLine } from "../types";
import { HEADER_LABEL, type Row, type ScanResult } from "./types";
import { parseDec, decToNumber, fmtDec } from "./numbers";
import { validate } from "./validate";

const num = (v?: string): number | undefined => {
  if (!v) return undefined;
  const d = parseDec(v);
  return d ? decToNumber(d) : undefined;
};

/**
 * Преобразование результата сканирования в карточку Clean Kitchen.
 * Исходные значения сохраняются в `original`, вычисленные — отдельно.
 */
export function toRecipe(res: ScanResult, importId: string): Recipe {
  const { computed, warnings } = validate(res);
  const h = (k: keyof typeof HEADER_LABEL) => res.header[k]?.v?.trim() ?? "";
  const ingredients: Ingredient[] = res.rows.map((r: Row) => {
    const c = (k: string) => (r.cols as any)[k]?.v?.trim() || undefined;
    const q = num(c("net")) ?? num(c("norm")) ?? num(c("cooked")) ?? num(c("gross"));
    const qRaw = c("net") ?? c("norm") ?? c("cooked") ?? c("gross") ?? "";
    const unit = r.unit.v.trim();
    return {
      name: r.name.v.trim(),
      amount: [qRaw, unit].filter(Boolean).join(" "),
      quantity: q,
      unit: unit || undefined,
      original: {
        n: r.n.v.trim() || undefined, name: r.name.v, unit: r.unit.v || undefined,
        gross: c("gross"), net: c("net"), cooked: c("cooked"), netPortions: c("netPortions"),
        norm: c("norm"), price: c("price"), sum: c("sum"), vat: c("vat")
      },
      computedSum: computed.rowSums[r.id]
    };
  });

  let cost: RecipeCost | undefined;
  if (res.colKeys.includes("price")) {
    const lines: CostLine[] = [];
    let complete = true, total = 0;
    for (const r of res.rows) {
      const qty = num(r.cols.norm?.v) ?? num(r.cols.net?.v);
      const price = num(r.cols.price?.v);
      const sum = num(r.cols.sum?.v);
      if (qty === undefined || price === undefined) { complete = false; continue; }
      const t = sum ?? qty * price;
      total += t;
      lines.push({ name: r.name.v, quantity: qty, unit: r.unit.v, pricePerUnit: price, total: t });
    }
    const portions = num(h("portions")) ?? null;
    const totalDoc = num(res.header.costTotal?.v) ?? num(res.totals.sum?.v);
    cost = { total: totalDoc ?? total, perPortion: num(h("costPerPortion")) ?? (portions ? (totalDoc ?? total) / portions : null), portions, complete, lines };
  }

  const name = h("dish") || "Карточка из документа";
  const yieldRaw = h("yield");
  const ym = yieldRaw.match(/(\d+(?:[.,]\d+)?)\s*([а-яa-z]+)?/i);
  const headerFlat: Record<string, string> = {};
  for (const k of Object.keys(res.header) as (keyof typeof HEADER_LABEL)[]) headerFlat[k] = res.header[k]!.v;
  const totalsFlat: Record<string, string> = {};
  for (const k of Object.keys(res.totals)) totalsFlat[k] = (res.totals as any)[k].v;
  const titles: Record<string, string> = {};
  for (const k of Object.keys(res.colTitles)) titles[k] = (res.colTitles as any)[k];

  return {
    id: `imp-${importId}`,
    name,
    category: /^п\/ф/i.test(name) ? "Заготовки" : "Импорт",
    yield: yieldRaw,
    time: "",
    description: `Импортировано из документа (${res.docType === "calc" ? "калькуляционная карта" : res.docType === "tech" ? "технологическая карта" : "карта"}). Проверено пользователем.`,
    ingredients,
    steps: res.tech.v.split(/\n+/).map((s) => s.trim()).filter(Boolean),
    tags: ["импорт"],
    cost,
    costCurrency: undefined,
    portionCount: num(h("portions")) ? Math.max(1, Math.round(num(h("portions"))!)) : undefined,
    yieldQuantity: ym ? num(ym[1]) : undefined,
    yieldUnit: ym?.[2],
    updatedAt: new Date().toISOString(),
    scan: {
      importId, docType: res.docType, engine: res.engine, confirmedAt: new Date().toISOString(),
      header: headerFlat, colTitles: titles, totals: totalsFlat,
      computedTotals: Object.fromEntries(Object.entries(computed.colSums).map(([k, v]) => [k, v as string])),
      signatures: res.signatures, warnings: warnings.map((w) => w.text), pages: new Set(res.rows.map((r) => r.page)).size || 1
    }
  };
}
export { fmtDec };
