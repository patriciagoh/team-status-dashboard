import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonForm } from "./PersonForm";
import type { Person } from "../types";

const person: Person = {
  id: "p1", name: "Maya R.", initials: "MR", role: "EM", team: "Platform",
  cat: "planned", conf: "high", what: "Failover", ticket: "PLAT-412", since: null,
  detail: { tickets: ["PLAT-412", "PLAT-409"], note: "Cycle commitment." },
};

describe("PersonForm", () => {
  it("renders labelled fields and submits parsed input (open items split into a list)", async () => {
    const onSave = vi.fn(async () => {});
    render(<PersonForm teams={["Platform"]} onSave={onSave} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name"), "Priya N.");
    await userEvent.type(screen.getByLabelText("Team"), "Platform");
    await userEvent.type(screen.getByLabelText("Working on"), "Federation");
    await userEvent.type(screen.getByLabelText("Open items"), "PLAT-388\nPLAT-390");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const input = onSave.mock.calls[0][0];
    expect(input.name).toBe("Priya N.");
    expect(input.team).toBe("Platform");
    expect(input.detail.tickets).toEqual(["PLAT-388", "PLAT-390"]);
  });

  it("requires a name and a team", async () => {
    const onSave = vi.fn(async () => {});
    render(<PersonForm teams={[]} onSave={onSave} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("prefills from an existing person in edit mode", () => {
    render(<PersonForm initial={person} teams={["Platform"]} onSave={async () => {}} onCancel={() => {}} onDelete={async () => {}} />);
    expect(screen.getByLabelText("Name")).toHaveValue("Maya R.");
    expect(screen.getByLabelText("Open items")).toHaveValue("PLAT-412\nPLAT-409");
  });

  it("shows an error and keeps input when save fails", async () => {
    const onSave = vi.fn(async () => { throw new Error("offline"); });
    render(<PersonForm initial={person} teams={["Platform"]} onSave={onSave} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn.t save/i);
    expect(screen.getByLabelText("Name")).toHaveValue("Maya R."); // input preserved
  });

  it("delete requires a confirm step then calls onDelete", async () => {
    const onDelete = vi.fn(async () => {});
    render(<PersonForm initial={person} teams={["Platform"]} onSave={async () => {}} onCancel={() => {}} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
    expect(onDelete).not.toHaveBeenCalled(); // first click only arms it
    await userEvent.click(screen.getByRole("button", { name: /Confirm delete/ }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
