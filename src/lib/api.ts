/**
 * Ma'lumot yuklash qatlami.
 *
 * Tartib:
 *   1. VITE_USE_MOCK=true bo'lsa — darhol mock data.
 *   2. Server (GET /api/recipes) — javob kelsa va bo'sh bo'lmasa, IndexedDB ga keshlanadi.
 *   3. Server javob bermasa / xato bo'lsa — IndexedDB keshi.
 *   4. Kesh ham bo'sh bo'lsa (yoki server bo'sh ro'yxat qaytarsa) — mock data (30 ta karta).
 */
import type { DataSource, Recipe } from "../types";
import { MOCK_RECIPES } from "../data/mockRecipes";
import { cacheRecipes, getLastSync, loadCachedRecipes, type OfflineRecipe } from "./offline";
import { fetchDelta, prefetchImagesInBackground, requestPersistence, storeDelta } from "./sync";

export const API_URL: string = import.meta.env.VITE_API_URL || "http://localhost:4000";
export const USE_MOCK: boolean = String(import.meta.env.VITE_USE_MOCK).toLowerCase() === "true";
const REQUEST_TIMEOUT_MS = 5000;

export type LoadResult = {
  recipes: Recipe[];
  source: Exclude<DataSource, "loading">;
  lastSync: string | null;
  error?: string;
};

export function mapApiRecipe(r: any): Recipe {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    department: r.department || "",
    section: r.section || "",
    yield: r.yieldLabel || "—",
    imageUrl: r.imageUrl,
    cost: r.cost,
    costCurrency: r.costCurrency,
    portionCount: r.portionCount,
    yieldQuantity: r.yieldQuantity,
    yieldUnit: r.yieldUnit,
    time: r.time || "—",
    description: r.description || "",
    ingredients: (r.ingredients || []).map((i: any) => ({
      name: i.name,
      amount: i.amount || [i.net ?? i.gross, i.unit].filter(Boolean).join(" "),
      quantity: i.gross ?? i.net,
      unit: i.unit
    })),
    steps: (r.steps || []).map((s: any) => (typeof s === "string" ? s : s.text)),
    stepImages: (r.steps || []).map((s: any) => (typeof s === "string" ? "" : s.imageUrl || "")),
    tags: r.aliases || [],
    version: r.version,
    updatedAt: r.updatedAt
  };
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
  } finally {
    clearTimeout(timer);
  }
}

function mockResult(error?: string): LoadResult {
  return { recipes: MOCK_RECIPES, source: "mock", lastSync: null, error };
}

export async function loadRecipes(): Promise<LoadResult> {
  if (USE_MOCK) return mockResult();

  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("Нет сети");
    void requestPersistence();
    // 1) delta-sync: с сервера приходит только новое/изменённое/убранное
    try {
      const delta = await fetchDelta(API_URL, mapApiRecipe, REQUEST_TIMEOUT_MS * 3);
      const all = await storeDelta(delta);
      if (all.length === 0) return mockResult("Серверда карточек нет");
      prefetchImagesInBackground(all);
      return { recipes: all, source: "server", lastSync: delta.serverTime };
    } catch (e: any) {
      if (e?.code !== 404) throw e; // старый сервер без /api/sync — обычная загрузка ниже
    }
    const res = await fetchWithTimeout(`${API_URL}/api/recipes?limit=200`, REQUEST_TIMEOUT_MS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items: unknown = Array.isArray(data) ? data : data?.items;
    if (!Array.isArray(items)) throw new Error("Неверный формат ответа");
    if (items.length === 0) return mockResult("Серверда карточек нет");
    const mapped = items.map(mapApiRecipe);
    const syncTime = new Date().toISOString();
    cacheRecipes(mapped as OfflineRecipe[]).catch(() => {});
    prefetchImagesInBackground(mapped);
    return { recipes: mapped, source: "server", lastSync: syncTime };
  } catch (e) {
    const error = e instanceof Error ? (e.name === "AbortError" ? "Server javob bermadi (timeout)" : e.message) : "Ulanish xatosi";
    try {
      const cached = await loadCachedRecipes();
      if (cached.length > 0) {
        return { recipes: cached as Recipe[], source: "cache", lastSync: await getLastSync(), error };
      }
    } catch {
      /* IndexedDB mavjud emas — mock ga o'tamiz */
    }
    return mockResult(error);
  }
}

/** Мгновенный старт: карточки с устройства показываются до ответа сервера */
export async function loadCachedFirst(): Promise<LoadResult | null> {
  if (USE_MOCK) return null;
  try {
    const cached = await loadCachedRecipes();
    if (!cached.length) return null;
    return { recipes: cached as Recipe[], source: "cache", lastSync: await getLastSync() };
  } catch { return null; }
}
