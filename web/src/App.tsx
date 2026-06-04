// web/src/App.tsx
import { useState } from "react";
import { derive } from "./roster";
import { mergeRoster } from "./roster/merge";
import type { RosterStore } from "./storage/RosterStore";
import { useRoster } from "./useRoster";
import { addEngineer, updateEngineer, removeEngineer, setCorrection, clearCorrection } from "./roster/mutations";
import type { EngineerInput } from "./roster/mutations";
import type { Correction } from "./types";
import { RosterActionsContext } from "./rosterActions";
import { Header } from "./components/Header";
import { SummaryStrip } from "./components/SummaryStrip";
import { RosterTable } from "./components/RosterTable";
import { PersonForm } from "./components/PersonForm";

type View = { mode: "list" } | { mode: "add" } | { mode: "edit"; id: string };

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="tsd-focus font-sans font-semibold text-[12px] px-[14px] py-[8px] rounded-[8px] border-0 cursor-pointer"
      style={{ background: "var(--matcha)", color: "var(--paper)", outlineColor: "var(--focus)" }}>
      {label}
    </button>
  );
}

function hasSignal(c: Correction): boolean {
  return c.cat !== undefined || (c.note ?? "") !== "";
}

export default function App({ store, onSignOut, editable = false }: { store?: RosterStore; onSignOut?: () => void; editable?: boolean }) {
  const { doc, error, commit } = useRoster(store);
  const [view, setView] = useState<View>({ mode: "list" });
  const toList = () => setView({ mode: "list" });

  if (error) {
    return (
      <div className="p-[38px_48px_44px] font-mono text-[13px]" style={{ color: "var(--rust-deep)" }}>
        Could not load the roster: {error}
      </div>
    );
  }
  if (!doc) {
    return <div className="p-[38px_48px_44px] font-mono text-[12px] text-muted">Loading…</div>;
  }

  const display = mergeRoster(doc);
  const d = derive(display);
  const teamNames = [...new Set(doc.engineers.map((e) => e.team))];

  if (editable && view.mode === "add") {
    return (
      <PersonForm teams={teamNames} onCancel={toList}
        onSave={(input: EngineerInput) => commit((dd) => addEngineer(dd, input)).then(toList)} />
    );
  }

  const editingEng = editable && view.mode === "edit" ? doc.engineers.find((e) => e.id === view.id) : undefined;
  if (editingEng) {
    const id = editingEng.id;
    return (
      <PersonForm
        initial={{ engineer: editingEng, correction: doc.corrections[id], work: doc.work.states[id] }}
        teams={teamNames} onCancel={toList}
        onSave={(input, correction) => commit((dd) => {
          const updated = updateEngineer(dd, id, input);
          return hasSignal(correction) ? setCorrection(updated, id, correction) : clearCorrection(updated, id);
        }).then(toList)}
        onDelete={() => commit((dd) => removeEngineer(dd, id)).then(toList)}
      />
    );
  }

  const actions = editable ? { onEditPerson: (id: string) => setView({ mode: "edit", id }) } : {};
  return (
    <RosterActionsContext.Provider value={actions}>
      <main className="p-[38px_48px_44px]">
        <Header snapshot={display.snapshot} total={d.total} onSignOut={onSignOut} />
        {d.total === 0 ? (
          <div className="mt-[26px] flex flex-col items-start gap-[14px]">
            <p className="font-mono text-[12px] text-muted">No one on the roster yet.</p>
            {editable && <AddButton label="Add your first engineer" onClick={() => setView({ mode: "add" })} />}
          </div>
        ) : (
          <>
            {editable && (
              <div className="mt-[18px]">
                <AddButton label="Add engineer" onClick={() => setView({ mode: "add" })} />
              </div>
            )}
            <SummaryStrip d={d} />
            <RosterTable d={d} />
          </>
        )}
      </main>
    </RosterActionsContext.Provider>
  );
}
