import { browserStorageAdapter } from "@/lib/storage";

export const safeJsonParse = <T,>(raw: string, fallback: T): T => {
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    return fallback;
  }
};

export const safeLocalStorageSet = async (key: string, value: string): Promise<boolean> => {
  try {
    await browserStorageAdapter.set(key, value);
    return true;
  } catch {
    return false;
  }
};
