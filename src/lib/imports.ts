/** Хранилище исходных изображений импортированных документов (IndexedDB, только на устройстве) */
const DB = "ck-imports";
const STORE = "docs";

export type StoredDoc = { id: string; createdAt: string; pages: Blob[] };

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function saveDoc(d: StoredDoc): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(d);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
export async function loadDoc(id: string): Promise<StoredDoc | undefined> {
  try {
    const db = await open();
    return await new Promise((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).get(id);
      r.onsuccess = () => res(r.result as StoredDoc | undefined);
      r.onerror = () => rej(r.error);
    });
  } catch { return undefined; }
}
export async function deleteDoc(id: string): Promise<void> {
  try {
    const db = await open();
    db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
  } catch { /* ignore */ }
}
