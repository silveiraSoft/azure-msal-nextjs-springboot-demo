/**
 * Public home page — Server Component.
 *
 * This page fetches data from the Next.js API route /api/public-data,
 * which in turn calls Spring Boot using an APPLICATION TOKEN (client credentials).
 *
 * The visiting user does NOT need to be logged in.
 * The app token is obtained server-side and never exposed to the browser.
 */

import LoginButton from "@/components/LoginButton";
import { getAppToken } from "@/lib/tokenService";

interface PublicItem {
  id: number;
  title: string;
  description: string;
}

interface PublicData {
  message: string;
  items: PublicItem[];
  tokenType: string;
}

async function fetchPublicData(): Promise<PublicData | null> {
  try {
    // Call the Spring Boot backend directly from this Server Component.
    // Using getAppToken() here avoids a self-referencing localhost fetch
    // that breaks in serverless environments (Vercel).
    const appToken = await getAppToken();
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_URL;

    const res = await fetch(`${backendUrl}/api/public/data`, {
      headers: {
        Authorization: `Bearer ${appToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const data = await fetchPublicData();

  return (
    <div className="space-y-8">
      <section className="text-center">
        <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3">
          Azure MSAL + Next.js + Spring Boot
        </h1>
        <p className="text-gray-500 text-lg">
          Public data is loaded with an <strong>application token</strong> — no login required.
          <br />
          Sign in to access the protected dashboard.
        </p>
      </section>

      {/* Public data fetched server-side with an app token */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-1">Public API Data</h2>
        {data ? (
          <>
            <p className="text-sm text-green-600 mb-4">
              Token type used: <code className="bg-green-50 px-1 rounded">{data.tokenType}</code>
            </p>
            <p className="text-gray-600 mb-4 italic">{data.message}</p>
            <div className="divide-y divide-gray-100">
              {data.items.map((item) => (
                <div key={item.id} className="py-3 flex items-start gap-3">
                  <span className="text-2xl font-bold text-gray-300">{item.id}</span>
                  <div>
                    <p className="font-medium text-gray-800">{item.title}</p>
                    <p className="text-gray-500 text-sm">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-red-500">
            Could not load data. Is the Spring Boot backend running on port 8080?
          </p>
        )}
      </section>

      {/* Call to action */}
      <section className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">
          Want to see the protected dashboard?
        </h2>
        <p className="text-blue-700 text-sm mb-4">
          Sign in with your Azure AD account to access personalised dashboard data.
        </p>
        <LoginButton />
      </section>
    </div>
  );
}
