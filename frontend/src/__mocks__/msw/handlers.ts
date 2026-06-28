/**
 * MSW (Mock Service Worker) request handlers.
 *
 * These intercept HTTP calls at the network level during tests.
 * They replace the real Spring Boot API without starting any server.
 *
 * Import these in tests that need API responses:
 *   import { server } from "@/__mocks__/msw/server";
 *   server.use(http.get(...)) to override a specific handler per-test.
 */

import { http, HttpResponse } from "msw";

const BACKEND = "http://localhost:8080";

export const handlers = [
  // ── Public endpoint (app token) ──────────────────────────────────────────
  http.get(`${BACKEND}/api/public/data`, () => {
    return HttpResponse.json({
      message: "This is public data fetched by the Next.js server using an application token.",
      items: [
        { id: 1, title: "Spring Boot", description: "Java backend framework" },
        { id: 2, title: "Next.js",     description: "React framework for production" },
        { id: 3, title: "Azure MSAL",  description: "Microsoft authentication library" },
      ],
      tokenType: "application (client credentials)",
      tokenSubject: "mock-service-principal",
    });
  }),

  // ── Dashboard endpoint (user token) ──────────────────────────────────────
  http.get(`${BACKEND}/api/dashboard/data`, ({ request }) => {
    const auth = request.headers.get("Authorization");

    // Simulate 401 if no token
    if (!auth || !auth.startsWith("Bearer ")) {
      return new HttpResponse(null, { status: 401 });
    }

    return HttpResponse.json({
      user: {
        name: "Test User",
        email: "testuser@demo.com",
        objectId: "mock-oid-12345",
        roles: ["User"],
      },
      scopes: "data.read openid profile",
      dashboard: [
        { metric: "Active Users",    value: 1234 },
        { metric: "Monthly Revenue", value: "$45,678" },
        { metric: "Open Tickets",    value: 42 },
        { metric: "Deployments",     value: 7 },
      ],
      message: "Welcome Test User! Role: General User",
    });
  }),

  // ── Admin endpoint ────────────────────────────────────────────────────────
  http.get(`${BACKEND}/api/dashboard/admin`, ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth) return new HttpResponse(null, { status: 401 });

    // Simulate 403 for non-admin tokens (simple heuristic in mock)
    if (auth.includes("user-token")) {
      return new HttpResponse(null, { status: 403 });
    }

    return HttpResponse.json({
      adminMessage: "You have Admin access, Test Admin.",
      sensitiveData: [
        { user: "alice@demo.com",   role: "Admin", lastLogin: "2026-06-27" },
        { user: "bob@demo.com",     role: "User",  lastLogin: "2026-06-26" },
      ],
      systemHealth: { database: "OK", cache: "OK", apiGateway: "OK" },
    });
  }),
];
