import { useCallback, useEffect, useMemo, useState } from "react";
import { browserStorageAdapter } from "@/lib/storage";
import { PersistedEnvelope, UseLocalStorageOptions, UseLocalStorageResult } from "@/types/storage";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isEnvelope = <T,>(value: unknown): value is PersistedEnvelope<T> =>
  isRecord(value) && typeof value.version === "number" && "data" in value;

const parseRaw = (raw: string): unknown => JSON.parse(raw) as unknown;

export function useLocalStorage<T>(options: UseLocalStorageOptions<T>): UseLocalStorageResult<T> {
  const { key, version, initialValue, validate, migrations } = options;

  const readValue = useCallback((): T => {
    try {
      const raw = browserStorageAdapter.getItem(key);
      if (raw === null) {
        return initialValue;
      }

      const parsed = parseRaw(raw);

      let workingVersion = 0;
      let workingData: unknown = parsed;

      if (isEnvelope<unknown>(parsed)) {
        workingVersion = parsed.version;
        workingData = parsed.data;
      }

      if (workingVersion > version) {
        return initialValue;
      }

      while (workingVersion < version) {
        const migrate = migrations?.[workingVersion];
        if (!migrate) {
          return initialValue;
        }

        workingData = migrate(workingData);
        workingVersion += 1;
      }

      if (validate && !validate(workingData)) {
        return initialValue;
      }

      return workingData as T;
    } catch {
      const corrupted = browserStorageAdapter.getItem(key);
      if (corrupted !== null) {
        const backupKey = `${key}:corrupt:${Date.now()}`;
        try {
          browserStorageAdapter.setItem(backupKey, corrupted);
          browserStorageAdapter.removeItem(key);
        } catch {
          // Ignore backup failures and continue with defaults.
        }
      }

      return initialValue;
    }
  }, [initialValue, key, migrations, validate, version]);

  const [value, setStateValue] = useState<T>(() => readValue());

  useEffect(() => {
    setStateValue(readValue());
  }, [readValue]);

  const persist = useCallback(
    (nextValue: T) => {
      const envelope: PersistedEnvelope<T> = {
        version,
        updatedAt: new Date().toISOString(),
        data: nextValue,
      };
      browserStorageAdapter.setItem(key, JSON.stringify(envelope));
    },
    [key, version],
  );

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setStateValue((prev) => {
        const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
        try {
          persist(resolved);
        } catch {
          // Fail closed: state is still updated in-memory.
        }
        return resolved;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    setStateValue(initialValue);
    try {
      browserStorageAdapter.removeItem(key);
    } catch {
      // Ignore clear failures.
    }
  }, [initialValue, key]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key) {
        return;
      }

      if (event.newValue === null) {
        setStateValue(initialValue);
        return;
      }

      try {
        const parsed = parseRaw(event.newValue);
        if (!isEnvelope<T>(parsed)) {
          return;
        }

        if (parsed.version !== version) {
          setStateValue(readValue());
          return;
        }

        if (validate && !validate(parsed.data)) {
          return;
        }

        setStateValue(parsed.data);
      } catch {
        // Ignore malformed cross-tab writes.
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [initialValue, key, readValue, validate, version]);

  return useMemo(
    () => ({ value, setValue, reset }),
    [reset, setValue, value],
  );
}
