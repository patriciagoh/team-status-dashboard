import type { Derived } from "../roster";
import { TeamOverviewRow } from "./TeamOverviewRow";
import { PersonRow } from "./PersonRow";

const GRID = "grid-cols-[34px_196px_1fr_132px_150px_86px] gap-[16px]";
const HEADERS = ["Person", "Working on", "Why", "Since last look", "Ticket"];

export function RosterTable({ d }: { d: Derived }) {
  const lastTeam = d.teams.length - 1;
  return (
    <section aria-label="Team roster" className="mt-[24px] bg-paper border border-line-2 rounded-xl overflow-hidden">
      <div className={`grid ${GRID} px-[16px] py-[11px] bg-oat border-b border-line-2`}>
        <span className="font-sans font-semibold text-[10px] leading-none tracking-[0.12em] uppercase text-muted">#</span>
        {HEADERS.map((h, i) => (
          <span key={h} className="font-sans font-semibold text-[10px] leading-none tracking-[0.12em] uppercase text-muted" style={{ textAlign: i === 4 ? "right" : "left" }}>
            {h}
          </span>
        ))}
      </div>
      {d.teams.map((team, ti) => (
        <div key={team.name}>
          <TeamOverviewRow team={team} first={ti === 0} />
          {team.people.map((p, i) => (
            <PersonRow key={`${team.name}-${i}`} person={p} idx={i + 1} last={ti === lastTeam && i === team.people.length - 1} />
          ))}
        </div>
      ))}
    </section>
  );
}
