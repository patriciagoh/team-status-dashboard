import { useEffect, useState } from "react";
import type { RosterData } from "./types";
import { derive } from "./roster";
import { Header } from "./components/Header";
import { SummaryStrip } from "./components/SummaryStrip";
import { RosterTable } from "./components/RosterTable";

export default function App() {
  const [data, setData] = useState<RosterData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}roster.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`roster.json ${r.status}`);
        return r.json();
      })
      .then((d: RosterData) => setData(d))
      .catch((e) => setError(String(e)));
  }, []);

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
      <Header snapshot={data.snapshot} total={d.total} />
      <SummaryStrip d={d} />
      <RosterTable d={d} />
    </main>
  );
}
