"use client";

/**
 * Dashboard.tsx
 *
 * Fetches protected data from Spring Boot using the USER access token.
 *
 * Flow:
 *   1. acquireTokenSilent() — tries to get a non-expired token from MSAL cache.
 *      If the cache token is expired, MSAL automatically refreshes it using
 *      the refresh token (no user interaction needed).
 *   2. Falls back to acquireTokenPopup() if silent renewal fails
 *      (e.g., refresh token expired, consent required).
 *   3. Sends the token in the Authorization: Bearer header to Spring Boot.
 *      Spring Boot validates it and checks for the SCOPE_data.read authority.
 */

import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { apiRequest } from "@/lib/msalConfig";

interface DashboardData {
  user: { name: string; email: string; objectId: string; roles: string[] };
  scopes: string;
  dashboard: Array<{ metric: string; value: string | number }>;
  message: string;
}

interface AdminData {
  adminMessage: string;
  sensitiveData: Array<{ user: string; role: string; lastLogin: string }>;
  systemHealth: Record<string, string>;
}

export default function Dashboard() {
  const { instance, accounts } = useMsal();
  const [data, setData] = useState<DashboardData | null>(null);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accounts.length === 0) return;

    async function fetchDashboard() {
      try {
        // -------------------------------------------------------------------
        // Step 1: Get the user access token
        // acquireTokenSilent checks the in-memory / sessionStorage MSAL cache.
        // -------------------------------------------------------------------
        let tokenResponse;
        try {
          tokenResponse = await instance.acquireTokenSilent({
            ...apiRequest,
            account: accounts[0], // use the currently signed-in account
          });
        } catch {
          // Silent renewal failed → prompt the user (popup)
          tokenResponse = await instance.acquireTokenPopup(apiRequest);
        }

        const accessToken = tokenResponse.accessToken;

        // -------------------------------------------------------------------
        // Step 2: Call Spring Boot with the token in the Authorization header.
        // Spring Boot (oauth2ResourceServer) extracts the JWT, validates it,
        // checks the audience, issuer, and then maps `scp` → SCOPE_data.read.
        // -------------------------------------------------------------------
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/dashboard/data`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) {
          throw new Error(`API error ${res.status}: ${await res.text()}`);
        }

        const dashboardJson = await res.json();
        setData(dashboardJson);

        // If the user has the Admin role, also fetch admin-only data
        if (dashboardJson.user?.roles?.includes("Admin")) {
          const adminRes = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/dashboard/admin`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (adminRes.ok) setAdminData(await adminRes.json());
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch dashboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [instance, accounts]);

  if (loading) return <p className="text-gray-500">Loading dashboard…</p>;
  if (error)   return <p className="text-red-600">Error: {error}</p>;
  if (!data)   return null;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-xl font-semibold text-blue-800">Welcome, {data.user.name}!</h2>
        <p className="text-blue-600 text-sm mt-1">{data.user.email}</p>
        <p className="text-gray-500 text-xs mt-1">Azure Object ID: {data.user.objectId}</p>
        <p className="text-gray-500 text-xs">Token scopes: {data.scopes}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.user.roles.map((role) => (
            <span
              key={role}
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                role === "Admin"
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {role}
            </span>
          ))}
        </div>
      </div>

      {/* Admin panel — only rendered if the backend confirmed Admin role */}
      {adminData && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-3">Admin Panel</h3>
          <p className="text-red-600 text-sm mb-3 italic">{adminData.adminMessage}</p>
          <div className="mb-3">
            <h4 className="text-sm font-medium text-gray-700 mb-1">System Health</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(adminData.systemHealth).map(([key, val]) => (
                <span key={key} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                  {key}: {val}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[320px]">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-1">User</th><th className="pb-1">Role</th><th className="pb-1">Last Login</th>
              </tr>
            </thead>
            <tbody>
              {adminData.sensitiveData.map((row) => (
                <tr key={row.user} className="border-b border-gray-100">
                  <td className="py-1">{row.user}</td>
                  <td className="py-1">{row.role}</td>
                  <td className="py-1 text-gray-500">{row.lastLogin}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <p className="text-gray-700 italic">{data.message}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {data.dashboard.map((item) => (
          <div key={item.metric} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-gray-500 text-sm">{item.metric}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
