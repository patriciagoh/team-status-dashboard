// web/src/components/Login.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Login } from "./Login";
import type { AuthPort } from "../auth/AuthPort";

function authPort(over: Partial<AuthPort> = {}): AuthPort {
  return {
    getSession: async () => null,
    signIn: vi.fn(async () => {}),
    signOut: async () => {},
    onAuthChange: () => () => {},
    ...over,
  };
}

describe("Login", () => {
  it("renders labelled email and password fields and a sign-in button", () => {
    render(<Login authPort={authPort()} />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("calls signIn with the entered credentials on submit", async () => {
    const signIn = vi.fn(async () => {});
    render(<Login authPort={authPort({ signIn })} />);
    await userEvent.type(screen.getByLabelText("Email"), "me@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "pw");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(signIn).toHaveBeenCalledWith("me@example.com", "pw");
  });

  it("shows a generic error alert on failure without leaking server detail", async () => {
    const signIn = vi.fn(async () => { throw new Error("Invalid login credentials"); });
    render(<Login authPort={authPort({ signIn })} />);
    await userEvent.type(screen.getByLabelText("Email"), "me@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Sign-in failed/i);
    expect(alert).not.toHaveTextContent(/Invalid login credentials/);
  });
});
