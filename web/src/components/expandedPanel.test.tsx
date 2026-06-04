import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpandedPanel } from "./ExpandedPanel";
import { RosterActionsContext } from "../rosterActions";
import type { Person } from "../types";

const person: Person = {
  id: "p1", name: "Maya R.", initials: "MR", role: "EM", team: "Platform",
  cat: "planned", conf: "high", what: "Failover", ticket: "PLAT-412", since: null,
  detail: { tickets: ["PLAT-412"], note: "Cycle commitment." },
};

describe("ExpandedPanel 'Correct my row'", () => {
  it("calls onEditPerson with the person id when the action is provided", async () => {
    const onEditPerson = vi.fn();
    render(
      <RosterActionsContext.Provider value={{ onEditPerson }}>
        <ExpandedPanel person={person} />
      </RosterActionsContext.Provider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Correct Maya's row/ }));
    expect(onEditPerson).toHaveBeenCalledWith("p1");
  });

  it("renders the button as display-only (no handler) when no action is provided", async () => {
    render(<ExpandedPanel person={person} />);
    const btn = screen.getByRole("button", { name: /Correct Maya's row/ });
    await userEvent.click(btn); // must not throw
    expect(btn).toBeInTheDocument();
  });
});
