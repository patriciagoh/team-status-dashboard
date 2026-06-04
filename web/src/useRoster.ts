// web/src/useRoster.ts
import { useEffect, useRef, useState } from "react";
import type { RosterData } from "./types";
import type { RosterStore } from "./storage/RosterStore";
import { createRosterStore } from "./storage/createRosterStore";
import { todaySnapshot } from "./storage/sanitize";

export function useRoster(store?: RosterStore) {
  const [roster, setRoster] = useState<RosterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const storeRef = useRef<RosterStore | null>(store ?? null);
  // Capture the initial store reference so that re-renders with a fresh object
  // (e.g. in tests) don't re-trigger the load effect.
  const initialStoreRef = useRef<RosterStore | undefined>(store);

  useEffect(() => {
    let cancelled = false;
    const ready = initialStoreRef.current
      ? Promise.resolve(initialStoreRef.current)
      : createRosterStore();
    ready
      .then((s) => { storeRef.current = s; return s.load(); })
      .then((d) => { if (!cancelled) { setRoster(d); setError(null); } })
      .catch((e) => { if (!cancelled) { setError(String(e)); setRoster(null); } });
    return () => { cancelled = true; };
  }, []);

  async function commit(updater: (r: RosterData) => RosterData) {
    if (!roster || !storeRef.current) return;
    const next: RosterData = { ...updater(roster), snapshot: todaySnapshot() };
    await storeRef.current.save(next); // throws on failure → caller keeps the user's input
    setRoster(next);
  }

  return { roster, error, commit };
}
