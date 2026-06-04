# Command View — Phase 3b: Honest roster model (config / pulled work / corrections)

**Date:** 2026-06-04
**Author:** Patricia Goh (with Claude)
**Status:** Approved for planning
**Part of:** Productionizing the Command View web app (Phases 0–5). Slots between Phase 3 (CRUD) and Phase 4 (deploy).
**Builds on:** Phase 3 (CRUD) — merged in #5.

## Problem

This app's nature is that work data is **pulled from Linear + Slack and
auto-classified** (the existing Python pipeline). Phase 3's CRUD let the human
hand-type that derived work data (category, "working on", ticket, why-note),
which is backwards — it would rot immediately and contradicts the product. We
must make the model honest *before* deploying (Phase 4): humans manage **who is
on the team and how they map to Linear/Slack**; work state is **pulled**; and a
**corrections** layer lets a human override a row. This phase reshapes the model
and UI; wiring the live pipeline→Supabase sync is a separate later phase.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Model | Three ownership layers: **roster config (human)**, **work state (pipeline, read-only)**, **corrections (human override)**. Display = merge of all three. |
| Roster source | **Manual** — the human adds engineers and maps each to a Linear user id / email. (Not auto-discovery from Linear.) |
| Editing | Engineer config + corrections are editable; **work fields are read-only** with a "synced at" freshness stamp. |
| Storage | Keep one `app_data` row per user; **separate columns** so two writers never clobber: `data jsonb` (human: engineers + corrections), new `work jsonb` (pipeline). The web app writes only `data`; the pipeline writes only `work`. |
| Sequencing | **Reshape the model + UI now.** The live pipeline→Supabase sync (Python writes `work` via the service key, on a schedule) is a **deferred later phase**. |
| Demo | The public fixture becomes a seeded `RosterDoc` (engineers + a baked work snapshot) so the demo still looks rich; demo stays read-only. |
| Migration | The sanitizer converts an old Phase-3 `teams[]` blob into the new shape (no throw, no data loss). |

## Data model

```ts
// Human-owned (edited in the web app)
export interface Engineer {
  id: string;                  // stable web-app id
  name: string;
  role: string;
  team: string;
  linearUserId: string | null; // mapping → Linear Member.id
  email: string | null;        // mapping → Slack/Linear by email
}
export interface Correction { cat?: Category; note?: string; } // "Correct my row" override

// Pipeline-owned (pulled & classified; READ-ONLY in the web app)
export interface WorkState {
  cat: Category;
  conf: Confidence;
  what: string;
  ticket: string | null;
  since: string | null;
  detail: PersonDetail;
}

export interface RosterDoc {
  engineers: Engineer[];                       // human
  corrections: Record<string, Correction>;     // human, keyed by engineer id
  work: { syncedAt: string | null; states: Record<string, WorkState> }; // pipeline, keyed by engineer id
}
```

The existing `Person`/`Team`/`RosterData`/`derive` stay as the **display
contract**; `RosterDoc` is the new **stored** contract. A pure `merge` converts
one into the other.

## Merge (pure) — `mergeRoster(doc): RosterData`

For each engineer (grouped by `team`, teams in first-seen order):

1. Start from the engineer's identity (`name`, `initials` derived, `role`, `team`).
2. Overlay `doc.work.states[engineer.id]` if present. If absent, the row has
   **no tracked activity** (see "No-activity handling" below) — we set
   `hasActivity: false` and inert defaults (`what: ""`, `ticket: null`, `since:
   null`, `detail: { tickets: [], note: "" }`, `conf: "high"`, placeholder
   `cat: "planned"` that is never rendered as a chip) rather than fabricating work.
3. Apply `doc.corrections[engineer.id]`: if `cat` is set, override the category
   (and set `hasActivity: true` — a correction is real signal); if `note` is set,
   override `detail.note` and mark the row corrected.

Output a `RosterData` (`teams[]` of `Person`) plus a top-level `syncedAt` carried
on the snapshot, then `derive()` runs unchanged.

### No-activity handling

A `Person` requires a `cat`. To avoid faking work, add `hasActivity: boolean`
to the display `Person` (default true; false when no work state and no
correction). The "Working on" cell renders **"no tracked activity"** (muted) when
`!hasActivity`, and such people are **excluded from the off-plan/firefighting
tallies** (they have no real category). For counting, `derive` treats
`hasActivity === false` as not contributing to category counts (they count in
headcount/total only). When `hasActivity` is false we still need a `cat` value
for the type; use `"planned"` as an inert placeholder that is never displayed as
a chip (the chip is replaced by the "no tracked activity" treatment).

## Storage, sanitizer, migration

- **Schema:** add `work jsonb not null default '{}'::jsonb` to `app_data`
  (pipeline-owned). RLS unchanged. The web app reads `data` + `work` and writes
  only `data`.
- **`sanitizeDoc(rawData, rawWork): RosterDoc`** is the new load boundary:
  - Recognized new shape (`engineers` array) → backfill ids/fields.
  - **Old Phase-3 shape** (`teams[]` of `Person`) → **migrate**: each person →
    an `Engineer` (id, name, role, team, `linearUserId: null`, derive `email:
    null`) and a `work.states[id]` from that person's `cat/what/ticket/since/
    conf/detail`; `corrections` from any with a note? No — migration maps the
    typed work into `work.states` so the row still shows, `corrections` empty.
  - Non-null unrecognized → throw (Phase 1 data-loss guard preserved).
  - `emptyDoc()` = `{ engineers: [], corrections: {}, work: { syncedAt: null, states: {} } }`.
- The `RowStore`/`RosterStore` seam now loads/saves the **human `data`** part
  (engineers + corrections); a separate read of the `work` column feeds the
  merge. (Save only writes `data`.)

## UI

- **Dashboard:** unchanged Command View, fed by `mergeRoster(doc)`. Header shows
  **"Synced · {time}"** (from `work.syncedAt`) or **"Not yet synced"**. Rows with
  no work state show **"no tracked activity."** Work fields are **read-only**.
- **One full-page form** (add + edit), reached by **"Add engineer"** /
  empty-state **"Add your first engineer"** and by the in-row **"Correct {name}'s
  row →"**:
  - **Engineer** section: Name (required), Role, Team (datalist), **Linear user
    id**, **Email**.
  - **Correction** section: category override (`— none —` + the six categories)
    and a note.
  - Read-only **Current work** panel (from `work.states[id]`) for reference.
  - **Delete** (two-click) in edit mode.
- Editing gated by `editable` (real build only); demo read-only.
- Saving uses the existing `useRoster` save-then-commit (writes the `data`
  column only).

## Pure mutations (reshaped)

Operate on `RosterDoc` (human side):
- `addEngineer(doc, input)` / `updateEngineer(doc, id, input)` /
  `removeEngineer(doc, id)` — manage `engineers[]` (and drop `corrections[id]` /
  ignore `work.states[id]` on remove; the pipeline prunes its own side later).
- `setCorrection(doc, id, correction)` / `clearCorrection(doc, id)` — manage
  `corrections`.
- `EngineerInput` = identity/config fields (no id, no work).

## Testing (TDD)

- `mergeRoster`: engineer with work state → merged row; without → `hasActivity
  false`, "no tracked activity", excluded from category tallies; correction
  overrides category/note; teams grouped/ordered.
- `sanitizeDoc`: new shape passes/backfills; **old Phase-3 `teams[]` migrates**
  to engineers + work states (no throw); garbage throws; `emptyDoc` valid.
- mutations: add/update/remove engineer; set/clear correction; immutable.
- `PersonForm` (reshaped): engineer fields + correction section; work read-only;
  required name; two-click delete; save-failure keeps input.
- App: editable empty → "Add your first engineer" → add → row appears as "no
  tracked activity" (no work yet); "Correct my row" opens the form; demo read-only.
- Demo fixture (seeded `RosterDoc`) renders the rich dashboard with a synced
  stamp.
- Demo bundle still ships no Supabase SDK.

## Out of scope (deferred to its own phase)

- **Pipeline → Supabase sync** (the live `work` writer): the Python pipeline
  emits the `work` snapshot (keyed by `linearUserId`) and writes it to the
  `work` column via the service key, on a schedule. Until then `work` is empty
  for real users (rows read "not yet synced / no tracked activity").
- Auto-discovery of engineers from Linear.
- Vercel deploy → Phase 4. Sentry → Phase 5.

## Risks & verification

- **Model migration**: the only real data is throwaway test rows; the sanitizer
  migrates old→new so nothing throws. Verified by a unit test on the old shape.
- **Honest empties**: rows without work state must not fabricate a category;
  enforced by `hasActivity` + tally exclusion (tested).
- **No-clobber**: human writes `data`, pipeline writes `work` — column-separated;
  the app never writes `work`.
- **Live check** (after build): log in → add an engineer (+ Linear id) → reload
  (persists) → it shows "no tracked activity / not yet synced" → add a correction
  → it overrides → delete → log out. (Real pulled work appears once the deferred
  sync phase lands.)
