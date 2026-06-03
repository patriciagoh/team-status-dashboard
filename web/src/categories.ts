import type { Category, Signal } from "./types";

export interface CategoryMeta {
  key: Category;
  label: string;
  order: number;
  signal: Signal;
  blurb: string;
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  planned:   { key: "planned",   label: "Planned",   order: 0, signal: "calm",    blurb: "On the roadmap / current cycle" },
  adhoc:     { key: "adhoc",     label: "Ad-hoc",    order: 1, signal: "calm",    blurb: "No-ticket request, picked up directly" },
  lent:      { key: "lent",      label: "Lent-out",  order: 2, signal: "neutral", blurb: "Helping another team this cycle" },
  support:   { key: "support",   label: "Support",   order: 3, signal: "neutral", blurb: "Customer escalation / on rotation" },
  unplanned: { key: "unplanned", label: "Unplanned", order: 4, signal: "attn",    blurb: "Off-plan work that appeared this cycle" },
  incident:  { key: "incident",  label: "Incident",  order: 5, signal: "urgent",  blurb: "Active incident / outage response" },
};

export const CAT_ORDER: Category[] = (Object.values(CATEGORIES) as CategoryMeta[])
  .sort((a, b) => a.order - b.order)
  .map((c) => c.key);
