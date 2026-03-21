import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { browserStorageAdapter } from "@/lib/storage";
import { LocalStorageSetResult, PersistedEnvelope, UseLocalStorageOptions, UseLocalStorageResult } from "@/types/storage";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isEnvelope = <T,>(value: unknown): value is PersistedEnvelope<T> =>
  isRecord(value) && typeof value.version === "number" && "data" in value;

export function useLocalStorage<T>(options: UseLocalStorageOptions<T>): UseLocalStorageResult<T> {
  const { key, version, initialValue, validate, migrations } = options;
  const [value, setStateValue] = useState<T>(initialValue);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const normalizeStoredValue = useCallback(
    (stored: unknown): T => {
      let workingVersion = 0;
      let workingData: unknown = stored;

      if (isEnvelope<unknown>(stored)) {
        workingVersion = stored.version;
        workingData = stored.data;
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
    },
    [initialValue, migrations, validate, version],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const stored = await browserStorageAdapter.get(key);
      if (cancelled || stored === null || stored === undefined) {
        return;
      }

      const resolved = normalizeStoredValue(stored);
      valueRef.current = resolved;
      setStateValue(resolved);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [key, normalizeStoredValue]);

  const persist = useCallback(
    async (nextValue: T) => {
      const envelope: PersistedEnvelope<T> = {
        version,
        updatedAt: new Date().toISOString(),
        data: nextValue,
      };

      await browserStorageAdapter.set(key, envelope);
    },
    [key, version],
  );

  const trySetValue = useCallback(
    (next: T | ((prev: T) => T)): LocalStorageSetResult<T> => {
      const previous = valueRef.current;
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(previous) : next;

      if (Object.is(previous, resolved)) {
        return {
          ok: true,
          previous,
          value: resolved,
        };
      }

      valueRef.current = resolved;
      setStateValue(resolved);
      void persist(resolved);

      return {
        ok: true,
        previous,
        value: resolved,
      };
    },
    [persist],
  );

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      trySetValue(next);
    },
    [trySetValue],
  );

  const reset = useCallback(() => {
    valueRef.current = initialValue;
    setStateValue(initialValue);
    void browserStorageAdapter.remove(key);
  }, [initialValue, key]);

  return useMemo(
    () => ({ value, setValue, trySetValue, reset }),
    [reset, setValue, trySetValue, value],
  );
}
