# Command View — Phase 3: Make it usable (CRUD)

**Date:** 2026-06-04
**Author:** Patricia Goh (with Claude)
**Status:** Approved for planning
**Part of:** Productionizing the Command View web app (Phases 0–5).
**Builds on:** Phase 2 (Login) — merged in #4. Supabase project is live and verified.

## Problem

The real build now logs in and loads a per-user roster, but the roster starts
**empty and there is no way to add to it** — the prototype was seed-only and the
"Correct my row" button is display-only. Phase 3 makes the app usable: create,
edit, and delete the people on your roster, wiring the "Correct my row"
affordance, with stable ids and live dates.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Core entity | **Person.** Full add/edit/delete. |
| Teams | **Person-centric (Option A):** teams are a field on the person. Typing a new team name creates the team; a team with ≥1 person exists; the last person leaving prunes it. No separate team-management screen. `Team.lead` defaults to `""` (not surfaced). |
| Navigation | **Simple full-page view** (no router): a `view` state swaps the dashboard for a full-page form. Not a modal (focus/a11y). Browser Back does not close the form; that's accepted. |
| Persistence | **Save-then-commit:** await `store.save(newRoster)` before updating UI; on failure keep the user's input and show an error (no lost edits, no desync). |
| Editing gate | An `editable` flag — true only in the authenticated real build. The public demo stays read-only. |
| Data shape | Keep `RosterData = { teams: Team[], snapshot }`; manage teams implicitly through person operations. |
| Dates | Each save refreshes `snapshot` to now (live "last updated"). |

## Architecture

```
web/src/roster/mutations.ts        # pure addPerson/updatePerson/removePerson + PersonInput + buildPerson
web/src/useRoster.ts               # hook: load + commit(updater) with save-then-update
web/src/rosterActions.ts           # RosterActionsContext ({ onEditPerson? })
web/src/components/PersonForm.tsx   # shared full-page add/edit form (Save/Cancel/Delete)
web/src/App.tsx                     # + view state (list|add|edit), editable prop, wires actions
web/src/components/ExpandedPanel.tsx# "Correct my row" calls context onEditPerson(id) when present
web/src/components/PersonRow.tsx    # key/panelId by person.id
web/src/components/RosterTable.tsx  # key people by person.id; "Add person" affordance (editable)
web/src/types.ts                    # Person gains id
web/src/storage/sanitize.ts         # backfill missing person.id
web/src/Root.tsx                    # pass editable in the authed branch
```

One job per unit: `mutations.ts` is pure logic; `useRoster` owns persistence;
`PersonForm` is presentation + local form state; `App` owns view state and wiring;
the context delivers the edit action without prop-drilling.

## Data model

`Person` gains `id: string` (stable). `sanitizeRoster` backfills
`crypto.randomUUID()` for any person without one (covers the empty bootstrap and
the demo fixture — both get session-stable ids; once a person is saved with an id
it is persisted). `RosterData` is otherwise unchanged.

```ts
export interface Person {
  id: string;               // NEW — stable unique id
  name: string; initials: string; role: string; team: string;
  cat: Category; conf: Confidence; what: string;
  ticket: string | null; since: string | null;
  detail: PersonDetail;
}
```

`PersonInput` = `Person` without `id` (the editable fields). `initials` is derived
from `name` in `buildPerson`/`updatePerson` (first letter of up to two words,
uppercased) and is not a form field.

## Pure mutations (`mutations.ts`)

No `Date` or IO inside — fully unit-testable.

- `buildPerson(input: PersonInput): Person` — `{ id: crypto.randomUUID(), initials: deriveInitials(input.name), ...input }`.
- `addPerson(roster, input)` — find the team named `input.team`; if absent, append
  `{ name: input.team, lead: "", people: [] }`; push `buildPerson(input)` into it.
- `updatePerson(roster, id, input)` — locate the person by `id`. Rebuild fields
  (re-derive `initials`, keep `id`). If `input.team` differs from the current team,
  remove from the old team (prune it if now empty) and add to the target team
  (create if new).
- `removePerson(roster, id)` — remove the person; prune an emptied team.

All return a new `RosterData` (immutably); `snapshot` is passed through unchanged
(snapshot refresh happens in the persistence boundary, keeping these pure).

## Persistence hook (`useRoster.ts`)

```ts
useRoster(store?: RosterStore): {
  roster: RosterData | null;
  error: string | null;          // load error
  commit(updater: (r: RosterData) => RosterData): Promise<void>; // save-then-update; throws on save failure
}
```

- On mount: resolve the store (passed in, or `createRosterStore()`), keep the
  instance, `load()` → set `roster` (or `error`). Same cancellation guard as today.
- `commit(updater)`: `const next = withFreshSnapshot(updater(roster));
  await store.save(next); setRoster(next);` — **save first, update only on
  success**. If `save` rejects, `commit` rejects and `roster` is unchanged (the
  caller — `PersonForm` — keeps the user's input and shows an error).
- `withFreshSnapshot(r)` sets `r.snapshot` to `todaySnapshot()` (live dates).

This is the unit-test surface for persistence (inject a fake store: commit saves
then updates; a rejecting save leaves state unchanged and rethrows).

## Shared form (`PersonForm.tsx`)

A full-page form used for both add and edit. Props:
`{ initial?: Person; teams: string[]; onSave(input: PersonInput): Promise<void>; onCancel(): void; onDelete?(): Promise<void> }`.

- Controlled fields: Name (required), Role, Team (`<input list>` with a datalist of
  existing team names — pick or type new), Category (`<select>`), Confidence
  (high/low `<select>`), Working on (`what`), Ticket, "Since" note, Open items
  (`<textarea>`, one ticket per line → `detail.tickets`), Why note (`<textarea>` →
  `detail.note`).
- Submit: build `PersonInput`, `await onSave(input)`. On rejection, show an inline
  `role="alert"` error and **stay on the form** (input preserved). On success the
  parent switches the view back to the list.
- Edit mode (`initial` + `onDelete` present): a **Delete** button that asks for a
  confirm (a two-click "Delete" → "Confirm delete" inline, no `window.confirm`),
  then `await onDelete()`.
- AA: every field has an associated `<label>`; visible focus rings (`var(--focus)`);
  the error region is `role="alert"`. Styling uses Matcha Oat tokens only (guardrail).

## App view state + wiring

`App` gains `editable?: boolean` (default `false`) and a `view` state:
`{ mode: "list" } | { mode: "add" } | { mode: "edit"; id: string }`.

- Uses `useRoster(store)` for `roster`/`error`/`commit`.
- `view.mode === "list"` → the dashboard (Header, SummaryStrip, RosterTable). When
  `editable`: the Header/empty-state expose **"Add person"** (empty state reads
  "Add your first person"); a `RosterActionsContext` provides
  `onEditPerson(id) → setView({mode:"edit", id})`.
- `view.mode === "add"` → `<PersonForm teams={teamNames} onSave={input => commit(r => addPerson(r, input)).then(toList)} onCancel={toList} />`.
- `view.mode === "edit"` → look up the person by id; `<PersonForm initial={person}
  teams={teamNames} onSave={input => commit(r => updatePerson(r, id, input)).then(toList)}
  onCancel={toList} onDelete={() => commit(r => removePerson(r, id)).then(toList)} />`.
- When **not** `editable` (demo): no Add button, no context action → "Correct my
  row" stays display-only, exactly as today. `commit` is never called.

`Root` passes `editable` in the authenticated branch
(`<App onSignOut={…} editable />`); the demo passthrough stays `<App />`.

## "Correct my row" (`ExpandedPanel`)

`ExpandedPanel` reads `onEditPerson` from `RosterActionsContext`. If present, the
"Correct {first}'s row" button calls `onEditPerson(person.id)`; if absent, the
button renders display-only as today (no behavior change for the demo).

## Stable ids in rows

`RosterTable` keys teams by `team.name` and people by `person.id`; `PersonRow`
builds `panelId` from `person.id` (`person-panel-${id}`) instead of the name slug.

## Testing (TDD)

- `mutations.test.ts` (node): add into a new team creates it; add into existing
  team appends; update changes fields + re-derives initials; update with a new team
  moves the person and prunes the empty source team; remove prunes an emptied team;
  ids are unique and preserved across updates; inputs are immutable (original
  roster unchanged).
- `useRoster.test.ts` (jsdom, fake store): load sets roster; `commit` saves then
  updates and refreshes the snapshot; a rejecting `save` leaves `roster` unchanged
  and `commit` rejects.
- `PersonForm.test.tsx` (jsdom): renders all labelled fields; submit calls `onSave`
  with the parsed input (Open items split into a tickets array; initials not a
  field); a rejecting `onSave` shows the alert and keeps values; delete requires the
  confirm step then calls `onDelete`.
- `App` (jsdom, injected fake store, `editable`): empty → "Add your first person" →
  fill → save → the new row appears and the fake store received the saved roster;
  "Correct my row" opens the edit form prefilled; demo (no `editable`) shows no Add
  button and an inert "Correct my row".
- Existing a11y/render tests stay green; demo bundle still ships no Supabase SDK.

## Out of scope (later phases)

- Vercel deploy, self-host fonts, configurable base, "run your own" → **Phase 4**.
- Sentry / telemetry → **Phase 5**.
- Team-lead editing, reordering, bulk import, team rename without touching members.

## Risks & verification

- **Stable-id churn:** the sanitizer assigns a random id only when one is missing;
  saved people always carry their id, so ids are stable in normal use. (No legacy
  data exists — the project started empty.)
- **Save failure / data safety:** save-then-commit means a failed save never
  updates the UI or desyncs; the form preserves the user's input for retry.
- **Demo untouched:** editing is gated by `editable`; the read-only demo path and
  the SDK-free bundle are preserved (re-verified).
- **Live end-to-end check** (after build): log in → add a person → reload (persists)
  → edit via "Correct my row" → delete → log out.
