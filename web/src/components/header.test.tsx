// web/src/components/header.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "./Header";
import type { Snapshot } from "../types";

const snapshot: Snapshot = {
  day: "Tuesday, June 3, 2026", time: "9:02 AM ET", prev: "x", next: "2:00 PM ET", slackConnected: true,
};

describe("Header sign-out", () => {
  it("shows a Sign out button and calls onSignOut when provided", async () => {
    const onSignOut = vi.fn();
    render(<Header snapshot={snapshot} total={3} onSignOut={onSignOut} />);
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("renders no sign-out control when onSignOut is absent", () => {
    render(<Header snapshot={snapshot} total={3} />);
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
  });
});
