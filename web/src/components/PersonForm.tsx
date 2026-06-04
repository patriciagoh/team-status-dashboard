// web/src/components/PersonForm.tsx
import { useId, useState, type FormEvent } from "react";
import type { Category, Correction, Engineer, WorkState } from "../types";
import type { EngineerInput } from "../roster/mutations";
import { CAT_ORDER, CATEGORIES } from "../categories";

const fieldClass = "font-mono text-[13px] text-ink px-[12px] py-[9px] rounded-[8px] border border-line-2 bg-transparent";
const labelClass = "flex flex-col gap-[6px] font-mono text-[12px] text-ink-2";

export interface PersonFormInitial { engineer: Engineer; correction?: Correction; work?: WorkState; }

export function PersonForm({
  initial, teams, onSave, onCancel, onDelete,
}: {
  initial?: PersonFormInitial;
  teams: string[];
  onSave: (input: EngineerInput, correction: Correction) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const listId = useId();
  const e = initial?.engineer;
  const [name, setName] = useState(e?.name ?? "");
  const [role, setRole] = useState(e?.role ?? "");
  const [team, setTeam] = useState(e?.team ?? "");
  const [linearUserId, setLinearUserId] = useState(e?.linearUserId ?? "");
  const [email, setEmail] = useState(e?.email ?? "");
  const [catOverride, setCatOverride] = useState<string>(initial?.correction?.cat ?? "");
  const [note, setNote] = useState(initial?.correction?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim() || !team.trim()) { setError("Name and team are required."); return; }
    const input: EngineerInput = {
      name: name.trim(), role: role.trim(), team: team.trim(),
      linearUserId: linearUserId.trim() || null,
      email: email.trim() || null,
    };
    const correction: Correction = {};
    if (catOverride) correction.cat = catOverride as Category;
    if (note.trim()) correction.note = note.trim();
    setError(null);
    setBusy(true);
    try {
      await onSave(input, correction);
      // success: parent navigates away (this form unmounts)
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      setBusy(false);
    }
  }

  async function onDeleteClick() {
    if (!onDelete) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    try { await onDelete(); }
    catch { setError("Couldn't delete. Check your connection and try again."); setBusy(false); setConfirmDelete(false); }
  }

  return (
    <main className="p-[38px_48px_44px] max-w-[640px]">
      <h1 className="font-serif font-normal text-[24px] leading-none tracking-[-0.02em] text-ink m-0">
        {initial ? "Edit engineer" : "Add engineer"}
      </h1>
      <form onSubmit={onSubmit} className="mt-[24px] flex flex-col gap-[16px]">
        <label className={labelClass}>
          Name
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={name} onChange={(ev) => setName(ev.target.value)} aria-required="true" />
        </label>
        <label className={labelClass}>
          Role
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={role} onChange={(ev) => setRole(ev.target.value)} />
        </label>
        <label className={labelClass}>
          Team
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={team} onChange={(ev) => setTeam(ev.target.value)} list={listId} aria-required="true" />
          <datalist id={listId}>{teams.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        <label className={labelClass}>
          Linear user id
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={linearUserId} onChange={(ev) => setLinearUserId(ev.target.value)} />
        </label>
        <label className={labelClass}>
          Email
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={email} onChange={(ev) => setEmail(ev.target.value)} />
        </label>

        {initial && (
          <>
            <div className="mt-[6px] rounded-sm px-[14px] py-[11px] bg-oat">
              <div className="font-sans font-semibold text-[10px] leading-none tracking-[0.13em] uppercase text-muted mb-[6px]">Current work (pulled, read-only)</div>
              <div className="font-mono text-[12px] text-ink-2">
                {initial.work ? `${CATEGORIES[initial.work.cat].label} · ${initial.work.what || "—"}` : "no tracked activity yet"}
              </div>
            </div>
            <label className={labelClass}>
              Category override
              <select className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={catOverride} onChange={(ev) => setCatOverride(ev.target.value)}>
                <option value="">— none —</option>
                {CAT_ORDER.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Correction note
              <textarea className={fieldClass} style={{ outlineColor: "var(--focus)" }} rows={3} value={note} onChange={(ev) => setNote(ev.target.value)} />
            </label>
          </>
        )}

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
