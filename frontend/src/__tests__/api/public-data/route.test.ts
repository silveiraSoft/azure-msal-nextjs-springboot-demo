/**
 * Integration test for the Next.js API route: GET /api/public-data
 *
 * This route:
 *   1. Calls getAppToken() (MSAL Node — server-side)
 *   2. Fetches Spring Boot /api/public/data with the token
 *   3. Returns the JSON to the browser
 *
 * Tools:
 *   jest.mock() — mocks tokenService and global fetch
 *   Direct handler invocation — calls the GET function directly (no HTTP server)
 *
 * Why call the handler directly instead of using a test server?
 * Next.js App Router route handlers are plain async functions that accept a
 * Request and return a Response. We can test them in isolation without starting
 * a Next.js or HTTP server — much faster.
 */

// Mock tokenService before importing the route handler
jest.mock("@/lib/tokenService", () => ({
  getAppToken: jest.fn(),
}));

import { GET } from "@/app/api/public-data/route";
import { getAppToken } from "@/lib/tokenService";

const mockGetAppToken = getAppToken as jest.Mock;

// Mock global fetch (used inside the route handler to call Spring Boot)
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockBackendResponse = {
  message: "This is public data",
  items: [{ id: 1, title: "Spring Boot", description: "Java backend" }],
  tokenType: "application (client credentials)",
  tokenSubject: "mock-principal",
};

function setupSuccessfulFlow() {
  mockGetAppToken.mockResolvedValue("mock-app-token");
  mockFetch.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue(mockBackendResponse),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/public-data", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_BACKEND_API_URL = "http://localhost:8080";
  });

  it("returns 200 with data from Spring Boot", async () => {
    setupSuccessfulFlow();

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe("This is public data");
    expect(body.items).toHaveLength(1);
  });

  it("sends the app token in the Authorization header to Spring Boot", async () => {
    setupSuccessfulFlow();

    await GET();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/public/data"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer mock-app-token",
        }),
      })
    );
  });

  it("fetches from BACKEND_INTERNAL_URL when set (Docker mode)", async () => {
    setupSuccessfulFlow();
    process.env.BACKEND_INTERNAL_URL = "http://backend:8080";

    await GET();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("http://backend:8080"),
      expect.anything()
    );

    delete process.env.BACKEND_INTERNAL_URL;
  });

  it("returns 500 when getAppToken() throws", async () => {
    mockGetAppToken.mockRejectedValue(new Error("Azure AD unreachable"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toMatch(/failed to fetch public data/i);
  });

  it("returns upstream status when Spring Boot returns an error", async () => {
    mockGetAppToken.mockResolvedValue("mock-token");
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: jest.fn().mockResolvedValue("Service Unavailable"),
    });

    const response = await GET();

    expect(response.status).toBe(503);
  });
});
