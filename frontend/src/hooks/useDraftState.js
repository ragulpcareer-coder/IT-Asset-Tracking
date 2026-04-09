import { useEffect, useMemo, useState } from "react";

export default function useDraftState(storageKey, initialState) {
  const fallbackValue = useMemo(() => initialState, [initialState]);
  const [state, setState] = useState(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? { ...fallbackValue, ...JSON.parse(raw) } : fallbackValue;
    } catch {
      return fallbackValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Ignore draft persistence failures so forms still work offline/private mode.
    }
  }, [storageKey, state]);

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // noop
    }
  };

  return [state, setState, clearDraft];
}
