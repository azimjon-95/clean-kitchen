import type { Recipe } from "../types";
import { api, ApiError, type Me } from "./client";
import { cacheRecipes, getLastSync, loadCachedRecipes, setMeta, type OfflineRecipe } from "../lib/offline";
import { prefetchImagesInBackground } from "../lib/sync";
import type { LoadResult } from "../lib/api";

const ZONES: Record<string, string> = { hot: "Горячий цех", cold: "Холодный цех", prep: "Заготовочный цех", pastry: "Кондитерский цех" };

export function mapTenantRecipe(r: any, catName: Map<string, string>, currency: string): Recipe {
  return {
    id: r.id, name: r.name, category: (r.categoryId && catName.get(r.categoryId)) || "Без категории",
    department: r.zone ? ZONES[r.zone] : "", section: "", yield: r.yieldLabel || "—", time: "—", description: r.description || "",
    imageUrl: r.imageUrl || undefined, portionCount: r.portionCount || undefined, cost: r.cost, costCurrency: currency,
    ingredients: (r.ingredients || []).map((i: any) => ({ name: i.name, amount: [i.gross ?? i.net, i.unit].filter((x) => x != null && x !== "").join(" "), quantity: i.gross ?? i.net, unit: i.unit })),
    steps: (r.steps || []).map((s: any) => s.text), tags: []
  } as Recipe;
}

/** Карточки текущего ресторана (уже отфильтрованные сервером по правам). Офлайн — копия на устройстве (стирается при выходе). */
export async function loadTenantRecipes(me: Me): Promise<LoadResult> {
  try {
    if (navigator.onLine === false) throw new Error("Нет сети");
    if (me.tenantError) throw new ApiError(403, me.tenantError.message, me.tenantError.code);
    const [cats, recs] = await Promise.all([
      api<{ items: any[] }>("GET", "/categories").catch(() => ({ items: [] as any[] })),
      api<{ items: any[] }>("GET", "/recipes?full=1&limit=500")
    ]);
    const names = new Map(cats.items.map((c) => [c.id, c.name]));
    const mapped = recs.items.map((r) => mapTenantRecipe(r, names, me.restaurant?.currency ?? "UZS"));
    const now = new Date().toISOString();
    cacheRecipes(mapped as OfflineRecipe[]).then(() => setMeta("lastSync", now)).catch(() => {});
    prefetchImagesInBackground(mapped);
    return { recipes: mapped, source: "server", lastSync: now };
  } catch (e: any) {
    const error = e?.message || "Ошибка загрузки";
    if (e instanceof ApiError && e.status === 403) return { recipes: [], source: "server", lastSync: null, error };   // нет доступа — не показываем старую копию
    try { const c = await loadCachedRecipes(); if (c.length) return { recipes: c as Recipe[], source: "cache", lastSync: await getLastSync(), error }; } catch { /* */ }
    return { recipes: [], source: "server", lastSync: null, error };
  }
}
export async function loadTenantCached(): Promise<LoadResult | null> {
  try { const c = await loadCachedRecipes(); return c.length ? { recipes: c as Recipe[], source: "cache", lastSync: await getLastSync() } : null; } catch { return null; }
}

/** Отправка черновика сканера на сервер (раздел «Импорт», право imports.import). Всегда создаёт черновик. */
export async function pushImport(r: Recipe) {
  const UNITS = ["kg", "g", "l", "ml", "pcs"];
  return api<{ created: number; failed: number; errors: string[] }>("POST", "/imports", { recipes: [{
    name: r.name.slice(0, 160), description: (r.description || "").slice(0, 2000),
    ingredients: r.ingredients.slice(0, 200).map((i) => ({ name: i.name.slice(0, 120), unit: UNITS.includes(i.unit || "") ? i.unit : "g", ...(typeof i.quantity === "number" && i.quantity >= 0 ? { gross: i.quantity } : {}) })),
    steps: r.steps.filter(Boolean).slice(0, 100).map((text) => ({ text: text.slice(0, 2000) }))
  }] });
}
