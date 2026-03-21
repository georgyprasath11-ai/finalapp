import { browserStorageAdapter } from "@/lib/storage";
import type { StateStorage } from "zustand/middleware";

export const idbStorage: StateStorage = {
  getItem: async (key: string) => {
    const value = await browserStorageAdapter.get(key);
    return value ? JSON.stringify(value) : null;
  },
  setItem: async (key: string, value: string) => {
    await browserStorageAdapter.set(key, JSON.parse(value));
  },
  removeItem: async (key: string) => {
    await browserStorageAdapter.remove(key);
  },
};
