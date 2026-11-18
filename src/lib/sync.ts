/**
 * Синхронизация с сервером и офлайн-хранилище:
 *  • карточки — IndexedDB (delta-sync: с сервера скачивается только новое);
 *  • фото блюд — IndexedDB (blob), открываются без интернета;
 *  • оболочка приложения и «пакет» сканера — Cache Storage (service worker).
 */
import type { Recipe } from "../types";
import { applyDelta, getMeta, imageStats, listStoredImageUrls, loadCachedRecipes, putStoredImage, type OfflineRecipe } from "./offline";

const imageUrls = (r: Pick<Recipe, "imageUrl" | "stepImages">): string[] =>
  [r.imageUrl, ...(r.stepImages ?? [])].filter((u): u is string => !!u && /^https?:/i.test(u));

/** Просит браузер не удалять данные при нехватке места (важно для iOS/Android) */
export async function requestPersistence(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}

export type Delta = { items: Recipe[]; removedIds: string[]; full: boolean; serverTime: string };

export async function fetchDelta(apiUrl: string, map: (r: any) => Recipe, timeoutMs: number): Promise<Delta> {
  const since = await getMeta<string>("serverTime");
  const haveCache = (await loadCachedRecipes()).length > 0;
  const q = since && haveCache ? `?since=${encodeURIComponent(since)}` : "";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiUrl}/api/sync/recipes${q}`, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (res.status === 404) throw Object.assign(new Error("no-sync-endpoint"), { code: 404 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    return { items: (d.items ?? []).map(map), removedIds: d.removedIds ?? [], full: !!d.full, serverTime: d.serverTime ?? new Date().toISOString() };
  } finally { clearTimeout(t); }
}

export async function storeDelta(d: Delta): Promise<Recipe[]> {
  return (await applyDelta(d.items as OfflineRecipe[], d.removedIds, d.full, d.serverTime)) as Recipe[];
}

/* ───────── Фото ───────── */
export type Progress = (done: number, total: number, label: string) => void;

async function fetchImage(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { mode: "cors", referrerPolicy: "no-referrer" });
    if (!res.ok) return null;
    const b = await res.blob();
    return b.type.startsWith("image/") && b.size > 200 ? b : null;
  } catch { return null; } // нет CORS у источника — фото останется онлайн-only, интерфейс покажет иллюстрацию
}

/** Скачивает на устройство фото, которых там ещё нет. Возвращает число новых. */
export async function downloadImages(recipes: Recipe[], onProgress?: Progress, limit = 400): Promise<number> {
  if (!navigator.onLine) return 0;
  const have = await listStoredImageUrls();
  const todo = Array.from(new Set(recipes.flatMap(imageUrls))).filter((u) => !have.has(u)).slice(0, limit);
  let done = 0, saved = 0;
  onProgress?.(0, todo.length, "Фото блюд");
  const queue = todo.slice();
  const worker = async () => {
    for (let u = queue.shift(); u; u = queue.shift()) {
      const b = await fetchImage(u);
      if (b) { try { await putStoredImage(u, b); saved++; } catch { /* нет места */ } }
      onProgress?.(++done, todo.length, "Фото блюд");
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return saved;
}

let bg: Promise<void> | null = null;
/** Фоновая докачка фото после синхронизации (без блокировки интерфейса) */
export function prefetchImagesInBackground(recipes: Recipe[]) {
  if (bg || !navigator.onLine) return;
  if ((navigator as any).connection?.saveData) return;
  bg = downloadImages(recipes).then(() => undefined).catch(() => undefined).finally(() => { bg = null; });
}

/* ───────── Пакет «всё для работы без интернета» ───────── */
const PACK_CACHE = "ck-offline-pack";

export async function downloadAppPack(onProgress?: Progress, withOcr = true): Promise<{ files: number; bytes: number }> {
  if (!("caches" in window)) return { files: 0, bytes: 0 };
  const res = await fetch("/offline-manifest.json", { cache: "no-store" });
  if (!res.ok) throw new Error("manifest");
  const m: { app: string[]; ocr: string[] } = await res.json();
  const list = [...m.app, ...(withOcr ? m.ocr : [])];
  const cache = await caches.open(PACK_CACHE);
  let done = 0, bytes = 0;
  onProgress?.(0, list.length, "Файлы приложения");
  for (const url of list) {
    if (!(await cache.match(url))) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok) { bytes += Number(r.headers.get("content-length") ?? 0); await cache.put(url, r); }
      } catch { /* продолжим */ }
    }
    onProgress?.(++done, list.length, url.includes("tesseract") ? "Модель распознавания" : "Файлы приложения");
  }
  return { files: list.length, bytes };
}

export async function packStatus(): Promise<{ files: number; ocr: boolean }> {
  if (!("caches" in window)) return { files: 0, ocr: false };
  try {
    const c = await caches.open(PACK_CACHE);
    const keys = await c.keys();
    return { files: keys.length, ocr: keys.some((k) => k.url.includes("rus.traineddata")) };
  } catch { return { files: 0, ocr: false }; }
}

export async function storageSummary() {
  const img = await imageStats();
  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  const persisted = (await navigator.storage?.persisted?.().catch(() => false)) ?? false;
  return { images: img.count, imageBytes: img.bytes, usage: est?.usage ?? 0, quota: est?.quota ?? 0, persisted };
}
