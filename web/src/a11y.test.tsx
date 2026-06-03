import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RosterTable } from "./components/RosterTable";
import { derive } from "./roster";
import roster from "../public/roster.json";
import type { RosterData } from "./types";

const d = derive(roster as RosterData);

describe("accessibility", () => {
  it("each category is conveyed by a text label, not color alone", () => {
    render(<RosterTable d={d} />);
    expect(screen.getAllByText("Planned").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Incident").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Support").length).toBeGreaterThan(0);
  });

  it("person rows are keyboard-operable buttons", async () => {
    render(<RosterTable d={d} />);
    const first = screen.getByRole("button", { name: /Maya R\./ });
    first.focus();
    expect(first).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(first).toHaveAttribute("aria-expanded", "true");
  });

  it("an expanded row links its button to the panel via aria-controls", async () => {
    render(<RosterTable d={d} />);
    const first = screen.getByRole("button", { name: /Maya R\./ });
    await userEvent.click(first);
    const panelId = first.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId as string)).toBeInTheDocument();
  });
});
