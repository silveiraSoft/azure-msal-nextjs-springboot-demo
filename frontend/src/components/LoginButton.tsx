"use client";

/**
 * LoginButton.tsx
 *
 * Renders a Login or Logout button based on MSAL authentication state.
 *
 * useMsal() — hook from @azure/msal-react that exposes:
 *   instance   — the PublicClientApplication (all MSAL operations live here)
 *   accounts   — array of signed-in accounts (empty if not authenticated)
 *   inProgress — current auth operation ("none" | "login" | "logout" | ...)
 */

import { useMsal } from "@azure/msal-react";
import { loginRequest } from "@/lib/msalConfig";
import { useRouter } from "next/navigation";

export default function LoginButton() {
  const { instance, accounts, inProgress } = useMsal();
  const router = useRouter();
  const isAuthenticated = accounts.length > 0;

  async function handleLogin() {
    try {
      // loginPopup opens a popup window for Azure AD sign-in.
      // Alternative: instance.loginRedirect(loginRequest) for a full-page redirect.
      await instance.loginPopup(loginRequest);
      router.push("/dashboard");
    } catch (err) {
      console.error("Login failed:", err);
    }
  }

  async function handleLogout() {
    try {
      // logoutPopup signs out via popup and clears the MSAL cache.
      // Alternative: instance.logoutRedirect()
      await instance.logoutPopup({ account: accounts[0] });
      router.push("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }

  if (inProgress !== "none") {
    return (
      <button disabled className="px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed">
        Loading…
      </button>
    );
  }

  return isAuthenticated ? (
    <button
      onClick={handleLogout}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm max-w-[200px] sm:max-w-none truncate"
      title={`Sign out (${accounts[0].username})`}
    >
      Sign out (<span className="hidden sm:inline">{accounts[0].username}</span>
      <span className="sm:hidden">me</span>)
    </button>
  ) : (
    <button
      onClick={handleLogin}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm whitespace-nowrap"
    >
      Sign in with Microsoft
    </button>
  );
}
