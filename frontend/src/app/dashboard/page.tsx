"use client";

/**
 * Dashboard page — Client Component.
 *
 * Requires the user to be authenticated via MSAL.
 * If not authenticated, redirects to the home page.
 *
 * The Dashboard component fetches protected data from Spring Boot
 * using the user's access token (delegated flow).
 */

import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Dashboard from "@/components/Dashboard";

export default function DashboardPage() {
  const isAuthenticated = useIsAuthenticated();
  const { inProgress } = useMsal();
  const router = useRouter();

  useEffect(() => {
    // Wait until MSAL finishes initializing before redirecting
    if (inProgress === "none" && !isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, inProgress, router]);

  if (inProgress !== "none") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-lg">Authenticating…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // redirect in progress
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      <p className="text-gray-500">
        This data is fetched with your <strong>user (delegated) token</strong>.
        Spring Boot validates the token and checks for the{" "}
        <code className="bg-gray-100 px-1 rounded text-sm">data.read</code> scope.
      </p>
      <Dashboard />
    </div>
  );
}
