import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RosterTable } from "./RosterTable";
import { derive } from "../roster";
import { mergeRoster } from "../roster/merge";
import roster from "../../public/roster.json";
import type { RosterDoc } from "../types";

const d = derive(mergeRoster(roster as RosterDoc));

describe("roster table", () => {
  it("renders every person and team name", () => {
    render(<RosterTable d={d} />);
    expect(screen.getByText("Maya R.")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { expanded: false }).length).toBe(d.total);
  });

  it("clicking a person row expands it and reveals the why note", async () => {
    render(<RosterTable d={d} />);
    const devin = screen.getByRole("button", { name: /Devin O\./ });
    expect(devin).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(devin);
    expect(devin).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Paged 08:14/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Correct Devin's row/ })).toBeInTheDocument();
  });

  it("a low-confidence person shows the inferred tag when expanded", async () => {
    render(<RosterTable d={d} />);
    const tomas = screen.getByRole("button", { name: /Tomas B\./ });
    await userEvent.click(tomas);
    expect(screen.getByText(/inferred · low confidence/)).toBeInTheDocument();
  });
});
