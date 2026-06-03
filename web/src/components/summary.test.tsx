import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SummaryStrip } from "./SummaryStrip";
import { Header } from "./Header";
import { derive } from "../roster";
import roster from "../../public/roster.json";
import type { RosterData } from "../types";

const d = derive(roster as RosterData);

describe("summary strip", () => {
  it("renders the four stat labels", () => {
    render(<SummaryStrip d={d} />);
    expect(screen.getByText("on plan")).toBeInTheDocument();
    expect(screen.getByText("off plan")).toBeInTheDocument();
    expect(screen.getByText("firefighting")).toBeInTheDocument();
    expect(screen.getByText("changed")).toBeInTheDocument();
  });

  it("breakdown lists categories as text labels (no chart element)", () => {
    const { container } = render(<SummaryStrip d={d} />);
    expect(screen.getByText("Where the effort is going")).toBeInTheDocument();
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("header shows the snapshot freshness", () => {
    render(<Header snapshot={(roster as RosterData).snapshot} total={d.total} />);
    expect(screen.getByText(/Snapshot ·/)).toBeInTheDocument();
    expect(screen.getByText(/next refresh/)).toBeInTheDocument();
  });
});
