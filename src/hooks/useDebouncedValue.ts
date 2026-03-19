import { useEffect, useRef, useState } from "react";

/**
 * Returns a debounced version of `value` that only updates after `delayMs`
 * of inactivity.
 *
 * Bug fix: The original implementation compared object values by reference,
 * causing the debounce timeout to reset on every render when `value` was an
 * object literal (a new reference every render). This version serialises the
 * value to JSON for comparison so the effect only fires when the VALUE
 * actually changes, not just the reference.
 *
 * This means: if the caller passes { preset: "week", customStart: "", customEnd: "" }
 * on render 1 and { preset: "week", customStart: "", customEnd: "" } on render 2,
 * the effect does NOT reset the timeout because the serialised string is identical.
 * Only when a value actually changes (e.g. preset becomes "last30") does the
 * timeout reset.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  // Store the serialised form so we can compare by value, not reference
  const serialisedRef = useRef<string>(JSON.stringify(value));

  useEffect(() => {
    const serialised = JSON.stringify(value);

    // If the serialised value hasn't changed, do nothing — no timeout reset
    if (serialised === serialisedRef.current) {
      return;
    }

    serialisedRef.current = serialised;

    const timeoutId = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
    // We intentionally only depend on the serialised string, not `value` directly
    // to avoid the reference-equality problem described above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value), delayMs]);

  return debounced;
}
