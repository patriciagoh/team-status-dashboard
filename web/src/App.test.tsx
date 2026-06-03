import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import roster from "../public/roster.json";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(roster) } as Response),
  ));
});

describe("App", () => {
  it("loads the roster and renders the dashboard", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Team status")).toBeInTheDocument());
    expect(screen.getByText("on plan")).toBeInTheDocument();
    expect(screen.getByText("Maya R.")).toBeInTheDocument();
  });
});
