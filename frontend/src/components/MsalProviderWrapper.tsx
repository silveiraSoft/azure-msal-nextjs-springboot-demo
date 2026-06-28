"use client";

/**
 * MsalProviderWrapper.tsx
 *
 * MSAL requires a client component (it uses browser APIs).
 * This wrapper isolates the "use client" boundary so that the root layout
 * can remain a Server Component while still providing MSAL context to all
 * child client components.
 */

import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "@/lib/msalConfig";
import { ReactNode, useMemo } from "react";

interface Props {
  children: ReactNode;
}

export default function MsalProviderWrapper({ children }: Props) {
  // Create the PublicClientApplication once, memoized per render tree.
  // PublicClientApplication is the entry point for all browser-side MSAL operations.
  const msalInstance = useMemo(() => new PublicClientApplication(msalConfig), []);

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
