/**
 * msalConfig.ts — Browser (client-side) MSAL configuration
 *
 * Uses @azure/msal-browser / @azure/msal-react.
 * All values come from NEXT_PUBLIC_ env vars so they are available in the browser.
 *
 * This file is ONLY for the user-login (delegated) token flow.
 * For the application token (server-side), see tokenService.ts.
 */

import { Configuration, LogLevel, PopupRequest } from "@azure/msal-browser";

// ---------------------------------------------------------------------------
// PublicClientApplication configuration
// Used by MsalProvider wrapping the entire Next.js app.
// ---------------------------------------------------------------------------
export const msalConfig: Configuration = {
  auth: {
    /**
     * NEXT_PUBLIC_AZURE_CLIENT_ID
     * The client ID of the FRONTEND Azure AD app registration.
     * Used to identify your application to Azure AD during the auth flow.
     */
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID!,

    /**
     * Authority = the Azure AD endpoint for your tenant.
     * NEXT_PUBLIC_AZURE_TENANT_ID determines which tenant's users can sign in.
     *
     * Use "common"  → any Microsoft account (personal + work/school)
     * Use "organizations" → any work/school account
     * Use your tenantId  → only users in YOUR Azure AD tenant
     */
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID}`,

    /**
     * NEXT_PUBLIC_REDIRECT_URI
     * After a successful login, Azure AD redirects the browser here.
     * Must EXACTLY match one of the Redirect URIs configured in the Azure portal.
     */
    redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI ?? "http://localhost:3000",

    /**
     * Where to redirect after logout (optional).
     */
    postLogoutRedirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI ?? "http://localhost:3000",
  },

  cache: {
    /**
     * "sessionStorage" — tokens are cleared when the browser tab closes.
     * "localStorage"   — tokens persist across tabs/sessions (less secure).
     */
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false, // Set to true for IE11
  },

  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return; // Never log PII
        switch (level) {
          case LogLevel.Error:   console.error(message); break;
          case LogLevel.Warning: console.warn(message);  break;
          case LogLevel.Info:    console.info(message);  break;
          case LogLevel.Verbose: console.debug(message); break;
        }
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Scopes requested during user login
//
// NEXT_PUBLIC_BACKEND_SCOPE (e.g., api://<backendClientId>/data.read):
//   Tells Azure AD to include this scope in the ACCESS TOKEN returned to the
//   browser. Spring Boot checks for SCOPE_data.read on protected endpoints.
//
// "openid", "profile", "email":
//   Standard OIDC scopes. Required so Azure AD returns an ID token with
//   user identity claims (name, preferred_username, etc.).
// ---------------------------------------------------------------------------
export const loginRequest: PopupRequest = {
  scopes: [
    "openid",
    "profile",
    "email",
    process.env.NEXT_PUBLIC_BACKEND_SCOPE!, // grants data.read in the access token
  ],
};

// ---------------------------------------------------------------------------
// Scopes used when silently refreshing the access token for API calls.
// Must match what was requested at login.
// ---------------------------------------------------------------------------
export const apiRequest = {
  scopes: [process.env.NEXT_PUBLIC_BACKEND_SCOPE!],
};
