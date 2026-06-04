// web/src/App.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import roster from "../public/roster.json";
import type { RosterData } from "./types";
import type { RosterStore } from "./storage/RosterStore";

function storeOf(data: RosterData): RosterStore {
  return { load: async () => data, save: async () => {} };
}
function failingStore(message: string): RosterStore {
  return { load: async () => { throw new Error(message); }, save: async () => {} };
}

describe("App", () => {
  it("loads from the store and renders the dashboard", async () => {
    render(<App store={storeOf(roster as RosterData)} />);
    await waitFor(() => expect(screen.getByText("Team status")).toBeInTheDocument());
    expect(screen.getByText("on plan")).toBeInTheDocument();
    expect(screen.getByText("Maya R.")).toBeInTheDocument();
  });

  it("renders an honest empty state when the roster has no people", async () => {
    const empty: RosterData = { teams: [], snapshot: (roster as RosterData).snapshot };
    render(<App store={storeOf(empty)} />);
    await waitFor(() => expect(screen.getByText(/No one on the roster yet/i)).toBeInTheDocument());
    expect(screen.queryByText("on plan")).toBeNull();
  });

  it("shows the error message when the store load fails", async () => {
    render(<App store={failingStore("roster.json 503")} />);
    await waitFor(() => expect(screen.getByText(/Could not load the roster/)).toBeInTheDocument());
    expect(screen.getByText(/503/)).toBeInTheDocument();
  });
});
