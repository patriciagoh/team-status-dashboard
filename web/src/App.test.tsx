import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import roster from "../public/roster.json";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(roster) } as Response),
  ));
});

afterEach(() => vi.unstubAllGlobals());

describe("App", () => {
  it("loads the roster and renders the dashboard", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Team status")).toBeInTheDocument());
    expect(screen.getByText("on plan")).toBeInTheDocument();
    expect(screen.getByText("Maya R.")).toBeInTheDocument();
  });

  it("shows the error message when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: false, status: 503 } as Response),
    ));
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText(/Could not load the roster/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/503/)).toBeInTheDocument();
  });
});
