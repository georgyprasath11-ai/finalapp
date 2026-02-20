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
}

export interface UseLocalStorageResult<T> {
  value: T;
  setValue: (next: T | ((prev: T) => T)) => void;
  reset: () => void;
}
