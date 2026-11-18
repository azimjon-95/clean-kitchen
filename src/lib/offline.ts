/**
 * Clean Kitchen — Offline layer (V10)
 *
 * Uses IndexedDB for persistent local cache of recipes + favorites.
 * Works without any paid services. Search continues offline via the
 * same client-side smart match already present in the app.
 */

const DB_NAME = "clean-kitchen-offline";
const DB_VERSION = 2;
const IMAGES_STORE = "images";
const RECIPES_STORE = "recipes";
const META_STORE = "meta";
const FAVORITES_STORE = "favorites";

export type OfflineRecipe = {
  id: string;
  name: string;
  category: string;
  yield: string;
  time?: string;
  description: string;
  ingredients: { name: string; amount: string; quantity?: number; unit?: string }[];
  steps: string[];
  stepImages?: string[];
  tags: string[];
  imageUrl?: string;
  popular?: boolean;
  cost?: any;
  costCurrency?: string;
  portionCount?: number;
  yieldQuantity?: number;
  yieldUnit?: string;
  version?: number;
  updatedAt?: string;
};

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECIPES_STORE)) {
        const store = db.createObjectStore(RECIPES_STORE, { keyPath: "id" });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("name", "name", { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
        db.createObjectStore(FAVORITES_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        db.createObjectStore(IMAGES_STORE, { keyPath: "url" });
      }
    };
  });
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Save full list of recipes into IndexedDB (replaces previous cache). */
export async function cacheRecipes(recipes: OfflineRecipe[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([RECIPES_STORE, META_STORE], "readwrite");
  const store = tx.objectStore(RECIPES_STORE);
  // Clear old data then write new
  store.clear();
  for (const r of recipes) {
    store.put(r);
  }
  tx.objectStore(META_STORE).put({
    key: "lastSync",
    value: new Date().toISOString(),
    count: recipes.length
  });
  await txDone(tx);
  db.close();
}

/** Load all cached recipes. */
export async function loadCachedRecipes(): Promise<OfflineRecipe[]> {
  const db = await openDb();
  const tx = db.transaction(RECIPES_STORE, "readonly");
  const store = tx.objectStore(RECIPES_STORE);
  const request = store.getAll();
  const result = await new Promise<OfflineRecipe[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

/** Get last successful sync timestamp. */
export async function getLastSync(): Promise<string | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(META_STORE, "readonly");
    const request = tx.objectStore(META_STORE).get("lastSync");
    const row = await new Promise<any>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/** Persist favorites list. */
export async function saveFavorites(ids: string[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(FAVORITES_STORE, "readwrite");
  const store = tx.objectStore(FAVORITES_STORE);
  store.clear();
  for (const id of ids) {
    store.put({ id });
  }
  await txDone(tx);
  db.close();
}

/** Load favorites from IndexedDB. */
export async function loadFavorites(): Promise<string[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(FAVORITES_STORE, "readonly");
    const request = tx.objectStore(FAVORITES_STORE).getAll();
    const rows = await new Promise<any[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return rows.map(r => r.id);
  } catch {
    return [];
  }
}

/** Simple online/offline observer. */
export function createConnectivityWatcher(onChange: (online: boolean) => void) {
  const handler = () => onChange(navigator.onLine);
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  onChange(navigator.onLine);
  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}


/* ───────── Мета-данные синхронизации ───────── */
export async function getMeta<T = string>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    const row = await new Promise<any>((res, rej) => {
      const r = db.transaction(META_STORE).objectStore(META_STORE).get(key);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    db.close();
    return row?.value ?? null;
  } catch { return null; }
}
export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readwrite");
  tx.objectStore(META_STORE).put({ key, value });
  await txDone(tx);
  db.close();
}

/**
 * Применить изменения с сервера: full=true — заменить весь набор, иначе — добавить/обновить
 * изменённые и удалить убранные. Возвращает итоговый список карточек из памяти устройства.
 */
export async function applyDelta(items: OfflineRecipe[], removedIds: string[], full: boolean, serverTime: string): Promise<OfflineRecipe[]> {
  const db = await openDb();
  const tx = db.transaction([RECIPES_STORE, META_STORE], "readwrite");
  const store = tx.objectStore(RECIPES_STORE);
  if (full) store.clear();
  for (const id of removedIds) store.delete(id);
  for (const r of items) store.put(r);
  const all = store.getAll();
  tx.objectStore(META_STORE).put({ key: "lastSync", value: serverTime });
  tx.objectStore(META_STORE).put({ key: "serverTime", value: serverTime });
  await txDone(tx);
  const out = (all.result || []) as OfflineRecipe[];
  db.close();
  return out;
}

/* ───────── Картинки на устройстве ───────── */
export type StoredImage = { url: string; blob: Blob; size: number; savedAt: number };

export async function getStoredImage(url: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    const row = await new Promise<StoredImage | undefined>((res, rej) => {
      const r = db.transaction(IMAGES_STORE).objectStore(IMAGES_STORE).get(url);
      r.onsuccess = () => res(r.result as StoredImage | undefined); r.onerror = () => rej(r.error);
    });
    db.close();
    return row?.blob ?? null;
  } catch { return null; }
}
export async function putStoredImage(url: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(IMAGES_STORE, "readwrite");
  tx.objectStore(IMAGES_STORE).put({ url, blob, size: blob.size, savedAt: Date.now() } satisfies StoredImage);
  await txDone(tx);
  db.close();
}
export async function listStoredImageUrls(): Promise<Set<string>> {
  try {
    const db = await openDb();
    const keys = await new Promise<IDBValidKey[]>((res, rej) => {
      const r = db.transaction(IMAGES_STORE).objectStore(IMAGES_STORE).getAllKeys();
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    db.close();
    return new Set(keys.map(String));
  } catch { return new Set(); }
}
export async function imageStats(): Promise<{ count: number; bytes: number }> {
  try {
    const db = await openDb();
    const rows = await new Promise<StoredImage[]>((res, rej) => {
      const r = db.transaction(IMAGES_STORE).objectStore(IMAGES_STORE).getAll();
      r.onsuccess = () => res(r.result as StoredImage[]); r.onerror = () => rej(r.error);
    });
    db.close();
    return { count: rows.length, bytes: rows.reduce((a, x) => a + (x.size || 0), 0) };
  } catch { return { count: 0, bytes: 0 }; }
}
export async function clearAllOffline(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([RECIPES_STORE, IMAGES_STORE, META_STORE], "readwrite");
  tx.objectStore(RECIPES_STORE).clear();
  tx.objectStore(IMAGES_STORE).clear();
  tx.objectStore(META_STORE).clear();
  await txDone(tx);
  db.close();
}
