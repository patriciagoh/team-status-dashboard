// web/src/App.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import roster from "../public/roster.json";
import type { RosterData } from "./types";
import type { RosterStore } from "./storage/RosterStore";
import { emptyRoster } from "./storage/sanitize";

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
    expect(screen.getByText("Team status")).toBeInTheDocument(); // Header still renders when empty
    expect(screen.queryByText("on plan")).toBeNull();
  });

  it("shows the error message when the store load fails", async () => {
    render(<App store={failingStore("roster.json 503")} />);
    await waitFor(() => expect(screen.getByText(/Could not load the roster/)).toBeInTheDocument());
    expect(screen.getByText(/503/)).toBeInTheDocument();
  });

  it("renders a Sign out button when onSignOut is provided", async () => {
    render(<App store={storeOf(roster as RosterData)} onSignOut={() => {}} />);
    await waitFor(() => expect(screen.getByText("Team status")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});

describe("App editing (editable build)", () => {
  function editableStore() {
    let current: RosterData = emptyRoster();
    return {
      store: { load: async () => current, save: async (d: RosterData) => { current = d; } } as RosterStore,
    };
  }

  it("empty state offers to add the first person; adding shows the row", async () => {
    const { store } = editableStore();
    render(<App store={store} editable />);
    await screen.findByText(/No one on the roster yet/i);
    await userEvent.click(screen.getByRole("button", { name: /Add your first person/i }));
    await userEvent.type(screen.getByLabelText("Name"), "Maya R.");
    await userEvent.type(screen.getByLabelText("Team"), "Platform");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(await screen.findByText("Maya R.")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
  });

  it("'Correct my row' opens the edit form prefilled", async () => {
    const seeded: RosterData = {
      teams: [{ name: "Platform", lead: "", people: [{
        id: "p1", name: "Maya R.", initials: "MR", role: "EM", team: "Platform",
        cat: "planned", conf: "high", what: "Failover", ticket: "PLAT-412", since: null,
        detail: { tickets: [], note: "n" },
      }] }],
      snapshot: { day: "d", time: "t", prev: "", next: "", slackConnected: false },
    };
    render(<App store={{ load: async () => seeded, save: async () => {} } as RosterStore} editable />);
    await userEvent.click(await screen.findByRole("button", { name: /Maya R\./ }));
    await userEvent.click(screen.getByRole("button", { name: /Correct Maya's row/ }));
    expect(screen.getByLabelText("Name")).toHaveValue("Maya R.");
  });

  it("the demo (not editable) shows no Add button", async () => {
    render(<App store={{ load: async () => emptyRoster(), save: async () => {} } as RosterStore} />);
    await screen.findByText(/No one on the roster yet/i);
    expect(screen.queryByRole("button", { name: /Add/i })).toBeNull();
  });
});
