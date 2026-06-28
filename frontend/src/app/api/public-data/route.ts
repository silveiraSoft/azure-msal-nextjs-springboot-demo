/**
 * /app/api/public-data/route.ts — Next.js Route Handler (server-side)
 *
 * This runs on the Next.js NODE.JS server, not in the browser.
 * It obtains an APPLICATION TOKEN via MSAL Node (client credentials)
 * and calls the Spring Boot /api/public/data endpoint.
 *
 * The browser never sees the client secret or the raw app token.
 */

import { NextResponse } from "next/server";
import { getAppToken } from "@/lib/tokenService";

export async function GET() {
  try {
    // 1. Get an application token (machine-to-machine, no user required)
    const appToken = await getAppToken();

    // 2. Call Spring Boot, passing the app token as a Bearer token.
    //
    // URL selection:
    //   BACKEND_INTERNAL_URL  — used inside Docker (container-to-container via
    //                           Docker network, e.g. http://backend:8080).
    //                           Set in docker-compose; never exposed to browser.
    //   NEXT_PUBLIC_BACKEND_API_URL — fallback for local non-Docker dev
    //                           (e.g. http://localhost:8080).
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_URL;

    const res = await fetch(
      `${backendUrl}/api/public/data`,
      {
        headers: {
          Authorization: `Bearer ${appToken}`,
          "Content-Type": "application/json",
        },
        // Disable Next.js fetch caching for fresh data each request.
        // Use { next: { revalidate: 60 } } to cache for 60 seconds.
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Spring Boot API error: ${res.status}`, detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[public-data route] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch public data", detail: String(err) },
      { status: 500 }
    );
  }
}
