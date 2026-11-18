// Minimal IndexedDB key-value store for the offline data snapshot.
// localStorage caps out around 5 MB on iPhone, which a coach with many
// clients' training and nutrition logs can outgrow - IndexedDB doesn't.
// Every call degrades to a no-op/undefined if IndexedDB is unavailable
// (private browsing), and callers fall back to localStorage.
const DB = "forge";
const STORE = "kv";
let dbPromise = null;

function open() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function run(mode, fn) {
  return open().then((db) => new Promise((resolve) => {
    if (!db) return resolve(undefined);
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => resolve(undefined);
      tx.onabort = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  }));
}

export const idbGet = (key) => run("readonly", (s) => s.get(key));
export const idbSet = (key, value) => run("readwrite", (s) => s.put(value, key)).then(() => true);
export const idbDel = (key) => run("readwrite", (s) => s.delete(key));
