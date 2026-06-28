/**
 * Integration tests for Dashboard component.
 *
 * Tests the full render cycle:
 *   acquireTokenSilent() → fetch backend → render data
 *
 * Tools:
 *   MSW (server) — intercepts fetch() calls inside the component
 *   RTL           — renders component and queries DOM
 *   waitFor()     — waits for async state updates (loading → data rendered)
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { useMsal } from "@azure/msal-react";
import { http, HttpResponse } from "msw";
import { server } from "@/__mocks__/msw/server";
import Dashboard from "@/components/Dashboard";

// MSW server lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockUseMsal = useMsal as jest.Mock;

const mockAccount = {
  username: "testuser@demo.com",
  homeAccountId: "mock-id",
  localAccountId: "mock-local",
  environment: "login.microsoftonline.com",
  tenantId: "mock-tenant",
};

function setupAuthenticatedMsal(acquireTokenResult = { accessToken: "mock-token" }) {
  mockUseMsal.mockReturnValue({
    instance: {
      acquireTokenSilent: jest.fn().mockResolvedValue(acquireTokenResult),
      acquireTokenPopup: jest.fn().mockResolvedValue(acquireTokenResult),
    },
    accounts: [mockAccount],
    inProgress: "none",
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Dashboard component", () => {
  it("shows loading state initially", () => {
    setupAuthenticatedMsal();
    render(<Dashboard />);
    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
  });

  it("renders user name and email after successful fetch", async () => {
    setupAuthenticatedMsal();
    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByText("Test User")).toBeInTheDocument()
    );

    expect(screen.getByText("testuser@demo.com")).toBeInTheDocument();
  });

  it("renders dashboard metrics from API response", async () => {
    setupAuthenticatedMsal();
    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByText("Active Users")).toBeInTheDocument()
    );

    expect(screen.getByText("1234")).toBeInTheDocument();
    expect(screen.getByText("Open Tickets")).toBeInTheDocument();
  });

  it("renders user role badge", async () => {
    setupAuthenticatedMsal();
    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByText("User")).toBeInTheDocument()
    );
  });

  it("does NOT render admin panel for User role", async () => {
    setupAuthenticatedMsal();
    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByText("Test User")).toBeInTheDocument()
    );

    expect(screen.queryByText(/admin panel/i)).not.toBeInTheDocument();
  });

  it("renders admin panel for Admin role user", async () => {
    setupAuthenticatedMsal();

    // Override the /api/dashboard/data handler to return Admin role
    server.use(
      http.get("http://localhost:8080/api/dashboard/data", () =>
        HttpResponse.json({
          user: {
            name: "Alice Admin",
            email: "alice@demo.com",
            objectId: "admin-oid",
            roles: ["Admin"],
          },
          scopes: "data.read",
          dashboard: [{ metric: "Active Users", value: 99 }],
          message: "Welcome Alice Admin! Role: Administrator",
        })
      )
    );

    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByText(/admin panel/i)).toBeInTheDocument()
    );

    expect(screen.getByText("System Health")).toBeInTheDocument();
  });

  it("shows error message when API call fails", async () => {
    setupAuthenticatedMsal();

    server.use(
      http.get("http://localhost:8080/api/dashboard/data", () =>
        new HttpResponse(null, { status: 500 })
      )
    );

    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    );
  });

  it("falls back to acquireTokenPopup when silent renewal fails", async () => {
    const acquireTokenPopup = jest.fn().mockResolvedValue({ accessToken: "popup-token" });

    mockUseMsal.mockReturnValue({
      instance: {
        acquireTokenSilent: jest.fn().mockRejectedValue(new Error("silent failed")),
        acquireTokenPopup,
      },
      accounts: [mockAccount],
      inProgress: "none",
    });

    render(<Dashboard />);

    await waitFor(() =>
      expect(acquireTokenPopup).toHaveBeenCalledTimes(1)
    );
  });

  it("renders nothing when no accounts (not authenticated)", () => {
    mockUseMsal.mockReturnValue({
      instance: { acquireTokenSilent: jest.fn() },
      accounts: [],
      inProgress: "none",
    });

    const { container } = render(<Dashboard />);
    // useEffect has early return when accounts is empty → nothing fetched
    expect(container.firstChild).toBeNull();
  });
});
