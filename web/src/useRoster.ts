// web/src/useRoster.ts
import { useEffect, useRef, useState } from "react";
import type { RosterDoc } from "./types";
import type { RosterStore } from "./storage/RosterStore";
import { createRosterStore } from "./storage/createRosterStore";

export function useRoster(store?: RosterStore) {
  const [doc, setDoc] = useState<RosterDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const storeRef = useRef<RosterStore | null>(store ?? null);
  const initialStoreRef = useRef<RosterStore | undefined>(store);

  useEffect(() => {
    let cancelled = false;
    const ready = initialStoreRef.current ? Promise.resolve(initialStoreRef.current) : createRosterStore();
    ready
      .then((s) => { storeRef.current = s; return s.load(); })
      .then((d) => { if (!cancelled) { setDoc(d); setError(null); } })
      .catch((e) => { if (!cancelled) { setError(String(e)); setDoc(null); } });
    return () => { cancelled = true; };
  }, []);

  async function commit(updater: (d: RosterDoc) => RosterDoc) {
    if (!doc || !storeRef.current) return;
    const next = updater(doc);
    await storeRef.current.save(next); // throws on failure → caller keeps the user's input
    setDoc(next);
  }

  return { doc, error, commit };
}
