// web/src/App.tsx
import { useState } from "react";
import { derive } from "./roster";
import type { RosterStore } from "./storage/RosterStore";
import { useRoster } from "./useRoster";
import { addPerson, removePerson, updatePerson } from "./roster/mutations";
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

export default function App({ store, onSignOut, editable = false }: { store?: RosterStore; onSignOut?: () => void; editable?: boolean }) {
  const { roster, error, commit } = useRoster(store);
  const [view, setView] = useState<View>({ mode: "list" });
  const toList = () => setView({ mode: "list" });

  if (error) {
    return (
      <div className="p-[38px_48px_44px] font-mono text-[13px]" style={{ color: "var(--rust-deep)" }}>
        Could not load the roster: {error}
      </div>
    );
  }
  if (!roster) {
    return <div className="p-[38px_48px_44px] font-mono text-[12px] text-muted">Loading…</div>;
  }

  const d = derive(roster);
  const teamNames = roster.teams.map((t) => t.name);

  if (editable && view.mode === "add") {
    return (
      <PersonForm teams={teamNames} onCancel={toList}
        onSave={(input) => commit((r) => addPerson(r, input)).then(toList)} />
    );
  }

  const editing = editable && view.mode === "edit" ? d.all.find((p) => p.id === view.id) : undefined;
  if (editing) {
    return (
      <PersonForm initial={editing} teams={teamNames} onCancel={toList}
        onSave={(input) => commit((r) => updatePerson(r, editing.id, input)).then(toList)}
        onDelete={() => commit((r) => removePerson(r, editing.id)).then(toList)} />
    );
  }

  const actions = editable ? { onEditPerson: (id: string) => setView({ mode: "edit", id }) } : {};
  return (
    <RosterActionsContext.Provider value={actions}>
      <main className="p-[38px_48px_44px]">
        <Header snapshot={roster.snapshot} total={d.total} onSignOut={onSignOut} />
        {d.total === 0 ? (
          <div className="mt-[26px] flex flex-col items-start gap-[14px]">
            <p className="font-mono text-[12px] text-muted">No one on the roster yet.</p>
            {editable && <AddButton label="Add your first person" onClick={() => setView({ mode: "add" })} />}
          </div>
        ) : (
          <>
            {editable && (
              <div className="mt-[18px]">
                <AddButton label="Add person" onClick={() => setView({ mode: "add" })} />
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
