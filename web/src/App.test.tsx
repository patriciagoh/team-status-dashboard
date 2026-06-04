// web/src/App.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import type { RosterDoc } from "./types";
import type { RosterStore } from "./storage/RosterStore";

const demoDoc: RosterDoc = {
  engineers: [{ id: "e1", name: "Maya R.", role: "EM", team: "Platform", linearUserId: null, email: null }],
  corrections: {},
  work: { syncedAt: "Tue 9:02 AM", states: { e1: { cat: "planned", conf: "high", what: "Failover", ticket: "PLAT-412", since: null, detail: { tickets: [], note: "n" } } } },
};
function storeOf(doc: RosterDoc): RosterStore { return { load: async () => doc, save: async () => {} }; }
function failingStore(message: string): RosterStore { return { load: async () => { throw new Error(message); }, save: async () => {} }; }

describe("App", () => {
  it("loads from the store and renders the dashboard", async () => {
    render(<App store={storeOf(demoDoc)} />);
    await waitFor(() => expect(screen.getByText("Team status")).toBeInTheDocument());
    expect(screen.getByText("on plan")).toBeInTheDocument();
    expect(screen.getByText("Maya R.")).toBeInTheDocument();
  });

  it("renders an honest empty state when the roster has no people", async () => {
    render(<App store={storeOf({ engineers: [], corrections: {}, work: { syncedAt: null, states: {} } })} />);
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
    render(<App store={storeOf(demoDoc)} onSignOut={() => {}} />);
    await waitFor(() => expect(screen.getByText("Team status")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});

describe("App editing (editable build)", () => {
  function editableStore() {
    let current: RosterDoc = { engineers: [], corrections: {}, work: { syncedAt: null, states: {} } };
    return { store: { load: async () => current, save: async (d: RosterDoc) => { current = d; } } as RosterStore };
  }

  it("empty → add your first engineer → the engineer appears as no tracked activity", async () => {
    const { store } = editableStore();
    render(<App store={store} editable />);
    await screen.findByText(/No one on the roster yet/i);
    await userEvent.click(screen.getByRole("button", { name: /Add your first engineer/i }));
    await userEvent.type(screen.getByLabelText("Name"), "Maya R.");
    await userEvent.type(screen.getByLabelText("Team"), "Platform");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(await screen.findByText("Maya R.")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getAllByText(/no tracked activity/).length).toBeGreaterThan(0);
  });

  it("'Correct my row' opens the editor prefilled", async () => {
    render(<App store={storeOf(demoDoc)} editable />);
    await userEvent.click(await screen.findByRole("button", { name: /Maya R\./ }));
    await userEvent.click(screen.getByRole("button", { name: /Correct Maya's row/ }));
    expect(screen.getByLabelText("Name")).toHaveValue("Maya R.");
    expect(screen.getByLabelText("Category override")).toBeInTheDocument();
  });

  it("the demo (not editable) shows no Add button", async () => {
    render(<App store={storeOf(demoDoc)} />);
    await screen.findByText("Maya R.");
    expect(screen.queryByRole("button", { name: /Add/i })).toBeNull();
  });
});
