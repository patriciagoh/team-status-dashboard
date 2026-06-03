/** A "since last look" note marks brand-new work this snapshot (vs. a change to existing work). Kept as a tolerant match because `since` is free text produced by the diff layer. */
export function isNewSnapshot(since: string | null): boolean {
  return !!since && /new this snapshot/i.test(since);
}
