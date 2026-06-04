// web/src/components/PersonForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonForm } from "./PersonForm";
import type { Correction, Engineer, WorkState } from "../types";
import type { EngineerInput } from "../roster/mutations";

const eng: Engineer = { id: "e1", name: "Maya R.", role: "EM", team: "Platform", linearUserId: "lin_1", email: "maya@x.com" };
const work: WorkState = { cat: "incident", conf: "high", what: "DB pool", ticket: "INC-1", since: null, detail: { tickets: ["INC-1"], note: "sev2" } };

describe("PersonForm (engineer + correction)", () => {
  it("submits engineer config from the Add form (no correction section)", async () => {
    const onSave = vi.fn<(input: EngineerInput, correction: Correction) => Promise<void>>(async () => {});
    render(<PersonForm teams={["Platform"]} onSave={onSave} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name"), "Priya N.");
    await userEvent.type(screen.getByLabelText("Team"), "Platform");
    await userEvent.type(screen.getByLabelText("Linear user id"), "lin_2");
    expect(screen.queryByLabelText("Category override")).toBeNull(); // no correction on add
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    const [input, correction] = onSave.mock.calls[0];
    expect(input).toMatchObject({ name: "Priya N.", team: "Platform", linearUserId: "lin_2" });
    expect(correction).toEqual({});
  });

  it("requires a name and a team", async () => {
    const onSave = vi.fn(async () => {});
    render(<PersonForm teams={[]} onSave={onSave} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("edit mode prefills engineer fields, shows read-only current work, and submits a correction", async () => {
    const onSave = vi.fn<(input: EngineerInput, correction: Correction) => Promise<void>>(async () => {});
    render(<PersonForm initial={{ engineer: eng, work }} teams={["Platform"]} onSave={onSave} onCancel={() => {}} onDelete={async () => {}} />);
    expect(screen.getByLabelText("Name")).toHaveValue("Maya R.");
    expect(screen.getByLabelText("Linear user id")).toHaveValue("lin_1");
    expect(screen.getByText(/DB pool/)).toBeInTheDocument(); // read-only current work
    await userEvent.selectOptions(screen.getByLabelText("Category override"), "unplanned");
    await userEvent.type(screen.getByLabelText("Correction note"), "pulled into triage");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    const [, correction] = onSave.mock.calls[0];
    expect(correction).toEqual({ cat: "unplanned", note: "pulled into triage" });
  });

  it("two-click delete then calls onDelete", async () => {
    const onDelete = vi.fn(async () => {});
    render(<PersonForm initial={{ engineer: eng }} teams={["Platform"]} onSave={async () => {}} onCancel={() => {}} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
    expect(onDelete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Confirm delete/ }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
