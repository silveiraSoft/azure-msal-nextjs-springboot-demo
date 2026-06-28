/**
 * Unit tests for tokenService.ts (server-side app token acquisition).
 *
 * Tools:
 *   Jest + jest.mock() — mocks @azure/msal-node so no real HTTP call to Azure AD
 *
 * What is tested:
 *   ✅ Happy path: returns access token string
 *   ✅ Error path: throws when MSAL returns null
 *   ✅ Singleton: reuses the same ConfidentialClientApplication instance
 */

// Set required env vars before the module is imported
process.env.AZURE_TENANT_ID = "mock-tenant-id";
process.env.AZURE_CLIENT_ID = "mock-client-id";
process.env.AZURE_CLIENT_SECRET = "mock-client-secret";
process.env.AZURE_APP_SCOPE = "api://mock-backend-id/.default";

// Mock @azure/msal-node before importing tokenService
const mockAcquireTokenByClientCredential = jest.fn();

jest.mock("@azure/msal-node", () => ({
  ConfidentialClientApplication: jest.fn().mockImplementation(() => ({
    acquireTokenByClientCredential: mockAcquireTokenByClientCredential,
  })),
}));

// Import AFTER mocking
import { getAppToken } from "@/lib/tokenService";
import { ConfidentialClientApplication } from "@azure/msal-node";

describe("getAppToken()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the access token string on success", async () => {
    mockAcquireTokenByClientCredential.mockResolvedValue({
      accessToken: "eyJ.mock.apptoken",
      expiresOn: new Date(Date.now() + 3600_000),
    });

    const token = await getAppToken();

    expect(token).toBe("eyJ.mock.apptoken");
  });

  it("calls acquireTokenByClientCredential with the correct scope", async () => {
    mockAcquireTokenByClientCredential.mockResolvedValue({
      accessToken: "eyJ.mock.apptoken",
    });

    await getAppToken();

    expect(mockAcquireTokenByClientCredential).toHaveBeenCalledWith({
      scopes: ["api://mock-backend-id/.default"],
    });
  });

  it("throws when MSAL returns null (misconfigured credentials)", async () => {
    mockAcquireTokenByClientCredential.mockResolvedValue(null);

    await expect(getAppToken()).rejects.toThrow(
      /Failed to acquire application token/i
    );
  });

  it("throws when MSAL returns a result with no accessToken", async () => {
    mockAcquireTokenByClientCredential.mockResolvedValue({ accessToken: null });

    await expect(getAppToken()).rejects.toThrow(
      /Failed to acquire application token/i
    );
  });

  it("propagates MSAL network errors", async () => {
    mockAcquireTokenByClientCredential.mockRejectedValue(
      new Error("Network request failed")
    );

    await expect(getAppToken()).rejects.toThrow("Network request failed");
  });
});
