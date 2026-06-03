import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryChip } from "./CategoryChip";
import { SinceNote } from "./SinceNote";
import { WorkingOn } from "./WorkingOn";
import type { Person } from "../types";

const base: Person = {
  name: "Tomas B.", initials: "TB", role: "Sr. Eng", team: "Platform",
  cat: "unplanned", conf: "low", what: "Likely the OOM crashes",
  ticket: "PLAT-431", since: "new this snapshot",
  detail: { tickets: ["PLAT-431"], note: "Inferred." },
};

describe("leaf components", () => {
  it("chip shows the category as a text label, not color alone", () => {
    render(<CategoryChip cat="incident" />);
    expect(screen.getByText("Incident")).toBeInTheDocument();
  });

  it("low-confidence WorkingOn renders the tentative '~' marker", () => {
    render(<WorkingOn person={base} />);
    expect(screen.getByText(/Likely the OOM crashes/)).toBeInTheDocument();
    expect(screen.getByText("~", { exact: false })).toBeInTheDocument();
  });

  it("SinceNote shows the change note when present, 'no change' when absent", () => {
    const { rerender } = render(<SinceNote person={base} />);
    expect(screen.getByText(/new this snapshot/)).toBeInTheDocument();
    rerender(<SinceNote person={{ ...base, since: null }} />);
    expect(screen.getByText("no change")).toBeInTheDocument();
  });
});
