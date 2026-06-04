// web/src/Root.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Root } from "./Root";
import type { AuthPort, Session } from "./auth/AuthPort";
import roster from "../public/roster.json";

// App (rendered when authed or in demo) loads via the default store → fetch the fixture.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(roster) } as Response)));
});
afterEach(() => vi.unstubAllGlobals());

function fakeAuthPort(initial: Session | null) {
  let listeners: Array<(s: Session | null) => void> = [];
  const port: AuthPort = {
    getSession: async () => initial,
    signIn: async () => {},
    signOut: async () => {},
    onAuthChange: (cb) => { listeners.push(cb); return () => { listeners = listeners.filter((l) => l !== cb); }; },
  };
  return { port, emit: (s: Session | null) => listeners.forEach((l) => l(s)) };
}

describe("Root", () => {
  it("renders the app directly (no login) when authPort is null (demo)", async () => {
    render(<Root authPort={null} />);
    await waitFor(() => expect(screen.getByText("Team status")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /sign in/i })).toBeNull();
  });

  it("shows Login when there is no session", async () => {
    const { port } = fakeAuthPort(null);
    render(<Root authPort={port} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument());
    expect(screen.queryByText("Team status")).toBeNull();
  });

  it("shows the app when a session exists", async () => {
    const { port } = fakeAuthPort({ userId: "u1", email: "a@b.c" });
    render(<Root authPort={port} />);
    await waitFor(() => expect(screen.getByText("Team status")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("reacts to onAuthChange: login then logout", async () => {
    const { port, emit } = fakeAuthPort(null);
    render(<Root authPort={port} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument());
    emit({ userId: "u1", email: "a@b.c" });
    await waitFor(() => expect(screen.getByText("Team status")).toBeInTheDocument());
    emit(null);
    await waitFor(() => expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument());
  });
});
