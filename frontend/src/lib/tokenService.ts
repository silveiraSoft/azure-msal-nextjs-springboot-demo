/**
 * tokenService.ts — Server-side APPLICATION TOKEN (client credentials flow)
 *
 * Uses @azure/msal-node (ConfidentialClientApplication).
 * Runs ONLY on the Next.js server — never in the browser.
 * Server-side env vars (no NEXT_PUBLIC_ prefix) keep the client secret private.
 *
 * Flow:
 *   Next.js server  →  POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
 *                       grant_type=client_credentials
 *                       client_id=AZURE_CLIENT_ID
 *                       client_secret=AZURE_CLIENT_SECRET
 *                       scope=AZURE_APP_SCOPE
 *                  ←  { access_token, expires_in, token_type }
 *   Next.js server  →  Spring Boot  (Authorization: Bearer <access_token>)
 */

import { ConfidentialClientApplication, Configuration } from "@azure/msal-node";

// ---------------------------------------------------------------------------
// MSAL Node configuration (server-side only)
// ---------------------------------------------------------------------------
const msalNodeConfig: Configuration = {
  auth: {
    /**
     * AZURE_CLIENT_ID
     * Client ID of the app registration used for machine-to-machine auth.
     * Can be the frontend app reg (with a client secret added) or a separate daemon app.
     */
    clientId: process.env.AZURE_CLIENT_ID!,

    /**
     * AZURE_CLIENT_SECRET
     * The secret generated in Azure Portal → App registrations → Certificates & secrets.
     * NEVER put this in a NEXT_PUBLIC_ variable or commit it to source control.
     */
    clientSecret: process.env.AZURE_CLIENT_SECRET!,

    /**
     * AZURE_TENANT_ID
     * Server-side copy of the tenant ID.
     */
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
  },
};

// Singleton — reuse across requests so MSAL can cache tokens internally
let _cca: ConfidentialClientApplication | null = null;

function getCca(): ConfidentialClientApplication {
  if (!_cca) {
    _cca = new ConfidentialClientApplication(msalNodeConfig);
  }
  return _cca;
}

// ---------------------------------------------------------------------------
// Acquire an application access token
// ---------------------------------------------------------------------------

/**
 * Returns a Bearer token for machine-to-machine API calls.
 * MSAL Node caches the token until 5 minutes before expiry, then auto-renews.
 *
 * @throws if the client credentials are missing or Azure AD rejects the request.
 */
export async function getAppToken(): Promise<string> {
  const cca = getCca();

  const result = await cca.acquireTokenByClientCredential({
    /**
     * AZURE_APP_SCOPE
     * Format: api://<BACKEND_CLIENT_ID>/.default
     *
     * The /.default suffix tells Azure AD to issue all app roles
     * that have been granted to this client app on the backend API.
     * This results in a token whose `roles` claim contains the app roles,
     * which Spring Boot maps to ROLE_<roleName> authorities.
     */
    scopes: [process.env.AZURE_APP_SCOPE!],
  });

  if (!result?.accessToken) {
    throw new Error(
      "Failed to acquire application token. Check AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_APP_SCOPE."
    );
  }

  return result.accessToken;
}
