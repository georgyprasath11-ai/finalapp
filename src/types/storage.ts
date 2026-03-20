export interface PersistedEnvelope<T> {
  version: number;
  updatedAt: string;
  data: T;
}

export interface LocalStorageMigrationMap {
  [fromVersion: number]: (legacyData: unknown) => unknown;
}

export interface UseLocalStorageOptions<T> {
  key: string;
  version: number;
  initialValue: T;
  validate?: (value: unknown) => value is T;
  migrations?: LocalStorageMigrationMap;
  onAfterPersist?: (key: string, value: string) => void;
}

export interface LocalStorageSetResult<T> {
  ok: boolean;
  previous: T;
  value: T;
  error?: Error;
}

export interface UseLocalStorageResult<T> {
  value: T;
  setValue: (next: T | ((prev: T) => T)) => void;
  trySetValue: (next: T | ((prev: T) => T)) => LocalStorageSetResult<T>;
  reset: () => void;
}
