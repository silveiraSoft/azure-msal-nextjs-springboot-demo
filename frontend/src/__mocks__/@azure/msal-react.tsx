/**
 * Manual mock for @azure/msal-react.
 *
 * Jest automatically picks this up because the file is at:
 *   src/__mocks__/@azure/msal-react.tsx
 * which shadows node_modules/@azure/msal-react in tests.
 *
 * Individual tests can override the defaults using jest.mocked():
 *   import { useMsal } from "@azure/msal-react";
 *   (useMsal as jest.Mock).mockReturnValue({ accounts: [fakeAccount], ... });
 */

import React from "react";

export const useMsal = jest.fn().mockReturnValue({
  instance: {
    loginPopup: jest.fn().mockResolvedValue({}),
    logoutPopup: jest.fn().mockResolvedValue({}),
    acquireTokenSilent: jest.fn().mockResolvedValue({ accessToken: "mock-access-token" }),
    acquireTokenPopup: jest.fn().mockResolvedValue({ accessToken: "mock-access-token" }),
  },
  accounts: [],
  inProgress: "none",
});

export const useIsAuthenticated = jest.fn().mockReturnValue(false);

export const useAccount = jest.fn().mockReturnValue(null);

// Render children directly — no real MSAL context needed in unit tests
export const MsalProvider = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

export const AuthenticatedTemplate = ({ children }: { children: React.ReactNode }) => null;

export const UnauthenticatedTemplate = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);
