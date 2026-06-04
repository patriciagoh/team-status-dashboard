// web/src/App.tsx
import { useEffect, useState } from "react";
import type { RosterData } from "./types";
import { derive } from "./roster";
import type { RosterStore } from "./storage/RosterStore";
import { createRosterStore } from "./storage/createRosterStore";
import { Header } from "./components/Header";
import { SummaryStrip } from "./components/SummaryStrip";
import { RosterTable } from "./components/RosterTable";

export default function App({ store, onSignOut }: { store?: RosterStore; onSignOut?: () => void }) {
  const [data, setData] = useState<RosterData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ready = store ? Promise.resolve(store) : createRosterStore();
    ready
      .then((s) => s.load())
      // Clear any stale error/data on resolution so a changed store prop can't
      // leave a previous error or rows stuck on screen (success clears error;
      // the catch below clears data).
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) { setError(String(e)); setData(null); } });
    return () => { cancelled = true; };
  }, [store]);

  if (error) {
    return (
      <div className="p-[38px_48px_44px] font-mono text-[13px]" style={{ color: "var(--rust-deep)" }}>
        Could not load the roster: {error}
      </div>
    );
  }
  if (!data) {
    return <div className="p-[38px_48px_44px] font-mono text-[12px] text-muted">Loading…</div>;
  }

  const d = derive(data);
  return (
    <main className="p-[38px_48px_44px]">
      <Header snapshot={data.snapshot} total={d.total} onSignOut={onSignOut} />
      {d.total === 0 ? (
        <p className="mt-[26px] font-mono text-[12px] text-muted">No one on the roster yet.</p>
      ) : (
        <>
          <SummaryStrip d={d} />
          <RosterTable d={d} />
        </>
      )}
    </main>
  );
}
