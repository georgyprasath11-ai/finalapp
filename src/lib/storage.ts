import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "studyforge";
const DB_VERSION = 1;
const STORE_NAME = "store";

const dbPromise: Promise<IDBPDatabase> = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  },
});

export const browserStorageAdapter = {
  async get(key: string): Promise<unknown> {
    try {
      return (await dbPromise).get(STORE_NAME, key) ?? null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown): Promise<void> {
    try {
      await (await dbPromise).put(STORE_NAME, value, key);
    } catch (err) {
      console.error("[StudyForge] IndexedDB write failed:", err);
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await (await dbPromise).delete(STORE_NAME, key);
    } catch (err) {
      console.error("[StudyForge] IndexedDB delete failed:", err);
    }
  },
};

const MIGRATION_FLAG = "studyforge:idb-migrated-v1";

export async function migrateFromLocalStorage(): Promise<void> {
  // Already migrated
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  const keys = Object.keys(localStorage).filter((k) => k.startsWith("study-dashboard:") || k.startsWith("app:"));

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      await browserStorageAdapter.set(key, parsed);
    } catch {
      // Skip keys that are not valid JSON
    }
  }

  localStorage.setItem(MIGRATION_FLAG, "true");
}

export async function requestPersistentStorage(): Promise<void> {
  if (navigator.storage && navigator.storage.persist) {
    const granted = await navigator.storage.persist();
    console.log(
      granted
        ? "[StudyForge] Persistent storage granted - data will not be auto-evicted"
        : "[StudyForge] Persistent storage not granted - data may be evicted under disk pressure",
    );
  }
}
