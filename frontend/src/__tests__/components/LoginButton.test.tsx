/**
 * Unit tests for LoginButton component.
 *
 * Tools:
 *   React Testing Library (RTL) — renders components and queries the DOM
 *   @testing-library/user-event — simulates real user interactions (click, type)
 *   jest.mocked() — gives TypeScript-aware access to mocked functions
 *
 * The @azure/msal-react mock (src/__mocks__/@azure/msal-react.tsx) is
 * applied automatically by Jest's module resolution.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMsal } from "@azure/msal-react";
import LoginButton from "@/components/LoginButton";

// useRouter is used inside LoginButton — mock it to prevent Next.js errors
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockUseMsal = useMsal as jest.Mock;

function renderLoginButton() {
  return render(<LoginButton />);
}

// ── Not authenticated ─────────────────────────────────────────────────────────

describe("when user is NOT authenticated", () => {
  beforeEach(() => {
    mockUseMsal.mockReturnValue({
      instance: {
        loginPopup: jest.fn().mockResolvedValue({}),
        logoutPopup: jest.fn(),
      },
      accounts: [],        // empty = not logged in
      inProgress: "none",
    });
  });

  it("renders a Sign in button", () => {
    renderLoginButton();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("does not render a Sign out button", () => {
    renderLoginButton();
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });

  it("calls loginPopup when Sign in is clicked", async () => {
    const loginPopup = jest.fn().mockResolvedValue({});
    mockUseMsal.mockReturnValue({
      instance: { loginPopup, logoutPopup: jest.fn() },
      accounts: [],
      inProgress: "none",
    });

    renderLoginButton();
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(loginPopup).toHaveBeenCalledTimes(1));
  });
});

// ── Authenticated ─────────────────────────────────────────────────────────────

describe("when user IS authenticated", () => {
  const mockAccount = {
    username: "alice@demo.com",
    name: "Alice Admin",
    homeAccountId: "mock-home-account-id",
    localAccountId: "mock-local-account-id",
    environment: "login.microsoftonline.com",
    tenantId: "mock-tenant-id",
  };

  beforeEach(() => {
    mockUseMsal.mockReturnValue({
      instance: {
        loginPopup: jest.fn(),
        logoutPopup: jest.fn().mockResolvedValue({}),
      },
      accounts: [mockAccount],   // non-empty = logged in
      inProgress: "none",
    });
  });

  it("renders a Sign out button with the username", () => {
    renderLoginButton();
    expect(
      screen.getByRole("button", { name: /sign out.*alice@demo\.com/i })
    ).toBeInTheDocument();
  });

  it("does not render a Sign in button", () => {
    renderLoginButton();
    expect(screen.queryByRole("button", { name: /sign in/i })).not.toBeInTheDocument();
  });

  it("calls logoutPopup when Sign out is clicked", async () => {
    const logoutPopup = jest.fn().mockResolvedValue({});
    mockUseMsal.mockReturnValue({
      instance: { loginPopup: jest.fn(), logoutPopup },
      accounts: [mockAccount],
      inProgress: "none",
    });

    renderLoginButton();
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(logoutPopup).toHaveBeenCalledTimes(1));
  });
});

// ── Loading state ──────────────────────────────────────────────────────────────

describe("when auth is in progress", () => {
  it("renders a disabled Loading button", () => {
    mockUseMsal.mockReturnValue({
      instance: { loginPopup: jest.fn(), logoutPopup: jest.fn() },
      accounts: [],
      inProgress: "login",   // MSAL is mid-operation
    });

    renderLoginButton();

    const btn = screen.getByRole("button", { name: /loading/i });
    expect(btn).toBeDisabled();
  });
});
