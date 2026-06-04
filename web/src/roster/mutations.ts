// web/src/roster/mutations.ts
import type { Correction, Engineer, RosterDoc } from "../types";

export interface EngineerInput {
  name: string;
  role: string;
  team: string;
  linearUserId: string | null;
  email: string | null;
}

export function deriveInitials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export function buildEngineer(input: EngineerInput): Engineer {
  return { id: crypto.randomUUID(), ...input };
}

export function addEngineer(doc: RosterDoc, input: EngineerInput): RosterDoc {
  return { ...doc, engineers: [...doc.engineers, buildEngineer(input)] };
}

export function updateEngineer(doc: RosterDoc, id: string, input: EngineerInput): RosterDoc {
  return { ...doc, engineers: doc.engineers.map((e) => (e.id === id ? { ...e, ...input } : e)) };
}

export function removeEngineer(doc: RosterDoc, id: string): RosterDoc {
  const corrections = { ...doc.corrections };
  delete corrections[id];
  return { ...doc, engineers: doc.engineers.filter((e) => e.id !== id), corrections };
}

export function setCorrection(doc: RosterDoc, id: string, correction: Correction): RosterDoc {
  return { ...doc, corrections: { ...doc.corrections, [id]: correction } };
}

export function clearCorrection(doc: RosterDoc, id: string): RosterDoc {
  const corrections = { ...doc.corrections };
  delete corrections[id];
  return { ...doc, corrections };
}
