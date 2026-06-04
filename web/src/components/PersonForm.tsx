import { useId, useState, type FormEvent } from "react";
import type { Person } from "../types";
import type { PersonInput } from "../roster/mutations";
import { CAT_ORDER, CATEGORIES } from "../categories";

const fieldClass =
  "font-mono text-[13px] text-ink px-[12px] py-[9px] rounded-[8px] border border-line-2 bg-transparent";
const labelClass = "flex flex-col gap-[6px] font-mono text-[12px] text-ink-2";

export function PersonForm({
  initial, teams, onSave, onCancel, onDelete,
}: {
  initial?: Person;
  teams: string[];
  onSave: (input: PersonInput) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const listId = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [team, setTeam] = useState(initial?.team ?? "");
  const [cat, setCat] = useState(initial?.cat ?? "planned");
  const [conf, setConf] = useState(initial?.conf ?? "high");
  const [what, setWhat] = useState(initial?.what ?? "");
  const [ticket, setTicket] = useState(initial?.ticket ?? "");
  const [since, setSince] = useState(initial?.since ?? "");
  const [openItems, setOpenItems] = useState((initial?.detail.tickets ?? []).join("\n"));
  const [note, setNote] = useState(initial?.detail.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !team.trim()) {
      setError("Name and team are required.");
      return;
    }
    const input: PersonInput = {
      name: name.trim(), role: role.trim(), team: team.trim(),
      cat, conf, what: what.trim(),
      ticket: ticket.trim() || null,
      since: since.trim() || null,
      detail: {
        tickets: openItems.split("\n").map((s) => s.trim()).filter(Boolean),
        note: note.trim(),
      },
    };
    setError(null);
    setBusy(true);
    try {
      await onSave(input);
      // success: the parent navigates back to the list (this form unmounts)
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      setBusy(false);
    }
  }

  async function onDeleteClick() {
    if (!onDelete) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    try {
      await onDelete();
    } catch {
      setError("Couldn't delete. Check your connection and try again.");
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <main className="p-[38px_48px_44px] max-w-[640px]">
      <h1 className="font-serif font-normal text-[24px] leading-none tracking-[-0.02em] text-ink m-0">
        {initial ? "Edit person" : "Add person"}
      </h1>
      <form onSubmit={onSubmit} className="mt-[24px] flex flex-col gap-[16px]">
        <label className={labelClass}>
          Name
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={name} onChange={(e) => setName(e.target.value)} aria-required="true" />
        </label>
        <label className={labelClass}>
          Role
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={role} onChange={(e) => setRole(e.target.value)} />
        </label>
        <label className={labelClass}>
          Team
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={team} onChange={(e) => setTeam(e.target.value)} list={listId} aria-required="true" />
          <datalist id={listId}>
            {teams.map((t) => <option key={t} value={t} />)}
          </datalist>
        </label>
        <label className={labelClass}>
          Category
          <select className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>
            {CAT_ORDER.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Confidence
          <select className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={conf} onChange={(e) => setConf(e.target.value as typeof conf)}>
            <option value="high">High</option>
            <option value="low">Low (inferred)</option>
          </select>
        </label>
        <label className={labelClass}>
          Working on
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={what} onChange={(e) => setWhat(e.target.value)} />
        </label>
        <label className={labelClass}>
          Ticket
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={ticket} onChange={(e) => setTicket(e.target.value)} />
        </label>
        <label className={labelClass}>
          Since note
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={since} onChange={(e) => setSince(e.target.value)} />
        </label>
        <label className={labelClass}>
          Open items
          <textarea className={fieldClass} style={{ outlineColor: "var(--focus)" }} rows={3} value={openItems} onChange={(e) => setOpenItems(e.target.value)} />
        </label>
        <label className={labelClass}>
          Why note
          <textarea className={fieldClass} style={{ outlineColor: "var(--focus)" }} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {error && <p role="alert" className="font-mono text-[12px] m-0" style={{ color: "var(--rust-deep)" }}>{error}</p>}

        <div className="flex items-center gap-[12px] mt-[6px]">
          <button type="submit" disabled={busy}
            className="tsd-focus font-sans font-semibold text-[13px] px-[16px] py-[10px] rounded-[8px] border-0 cursor-pointer disabled:opacity-60"
            style={{ background: "var(--matcha)", color: "var(--paper)", outlineColor: "var(--focus)" }}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onCancel}
            className="tsd-focus font-mono text-[12px] text-muted hover:text-ink-2 bg-transparent border-0 cursor-pointer p-0"
            style={{ outlineColor: "var(--focus)" }}>
            Cancel
          </button>
          {onDelete && (
            <button type="button" onClick={onDeleteClick} disabled={busy}
              className="tsd-focus font-mono text-[12px] ml-auto bg-transparent border-0 cursor-pointer p-0 disabled:opacity-60"
              style={{ color: "var(--rust-deep)", outlineColor: "var(--focus)" }}>
              {confirmDelete ? "Confirm delete" : "Delete"}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
