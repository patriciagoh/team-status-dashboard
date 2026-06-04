import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SummaryStrip } from "./SummaryStrip";
import { Header } from "./Header";
import { derive } from "../roster";
import roster from "../../public/roster.json";
import type { Person, RosterData } from "../types";

const d = derive(roster as RosterData);

function person(cat: Person["cat"]): Person {
  return {
    id: "s1", name: "X", initials: "X", role: "Eng", team: "T", cat, conf: "high",
    what: "", ticket: null, since: null, detail: { tickets: [], note: "" },
  };
}

describe("summary strip", () => {
  it("renders the four stat labels", () => {
    render(<SummaryStrip d={d} />);
    expect(screen.getByText("on plan")).toBeInTheDocument();
    expect(screen.getByText("off plan")).toBeInTheDocument();
    expect(screen.getByText("firefighting")).toBeInTheDocument();
    expect(screen.getByText("changed")).toBeInTheDocument();
  });

  it("'off plan' tile counts incident + unplanned (not unplanned alone)", () => {
    // 2 incidents + 1 unplanned → off plan = 3, a value unplanned alone can't produce
    const synthetic = derive({
      snapshot: roster.snapshot,
      teams: [{ name: "T", lead: "X Y", people: [
        person("incident"), person("incident"), person("unplanned"), person("planned"),
      ] }],
    } as RosterData);
    render(<SummaryStrip d={synthetic} />);
    const tile = screen.getByText("off plan").closest("div")!;
    expect(tile).toHaveTextContent("3");
  });

  it("breakdown lists categories as text labels (no chart element)", () => {
    const { container } = render(<SummaryStrip d={d} />);
    expect(screen.getByText("Where the effort is going")).toBeInTheDocument();
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("header shows the synced freshness", () => {
    render(<Header snapshot={(roster as RosterData).snapshot} total={d.total} />);
    expect(screen.getByText(/Synced ·/)).toBeInTheDocument();
  });
});
