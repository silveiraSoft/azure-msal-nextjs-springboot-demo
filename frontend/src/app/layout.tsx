/**
 * Root layout — Server Component.
 * Wraps the app with MsalProviderWrapper (client boundary) so MSAL context
 * is available throughout the component tree.
 */

import type { Metadata } from "next";
import MsalProviderWrapper from "@/components/MsalProviderWrapper";
import LoginButton from "@/components/LoginButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "Azure MSAL + Next.js + Spring Boot Demo",
  description: "Demonstrates user auth and app tokens with Azure AD",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        {/* MsalProviderWrapper is "use client" — the boundary stops here */}
        <MsalProviderWrapper>
          <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            <a href="/" className="text-xl font-bold text-gray-800 shrink-0">
              MSAL Demo
            </a>
            {/* LoginButton is a client component — reads MSAL state from context */}
            <div className="min-w-0">
              <LoginButton />
            </div>
          </header>
          <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">{children}</main>
        </MsalProviderWrapper>
      </body>
    </html>
  );
}

