import type { Category, RosterData, Person } from "./types";
import { CATEGORIES, CAT_ORDER } from "./categories";

const OFF_PLAN: Category[] = ["incident", "unplanned"];

export interface TallyItem { key: Category; label: string; count: number; }
export interface TeamDerived {
  name: string;
  headcount: number;
  people: Person[];
  tally: TallyItem[];
  offPlan: number;
}
export interface Derived {
  all: Person[];
  counts: Record<Category, number>;
  total: number;
  onPlan: number;
  offPlan: number;
  firefighting: number;
  changed: number;
  catOrder: Category[];
  teams: TeamDerived[];
}

function emptyCounts(): Record<Category, number> {
  return { planned: 0, adhoc: 0, lent: 0, support: 0, unplanned: 0, incident: 0 };
}

function sumOffPlan(c: Record<Category, number>): number {
  return OFF_PLAN.reduce((sum, k) => sum + c[k], 0);
}

export function derive(data: RosterData): Derived {
  const all: Person[] = data.teams.flatMap((t) => t.people);
  const counts = emptyCounts();
  for (const p of all) if (p.hasActivity !== false) counts[p.cat] += 1;

  const teams: TeamDerived[] = data.teams.map((t) => {
    const tc = emptyCounts();
    for (const p of t.people) if (p.hasActivity !== false) tc[p.cat] += 1;
    const tally: TallyItem[] = CAT_ORDER
      .filter((k) => tc[k] > 0)
      .map((k) => ({ key: k, label: CATEGORIES[k].label, count: tc[k] }));
    const offPlan = sumOffPlan(tc);
    return { name: t.name, headcount: t.people.length, people: t.people, tally, offPlan };
  });

  return {
    all,
    counts,
    total: all.length,
    onPlan: counts.planned,
    offPlan: sumOffPlan(counts),
    firefighting: counts.incident,
    changed: all.filter((p) => p.since).length,
    catOrder: CAT_ORDER,
    teams,
  };
}
