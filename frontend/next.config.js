/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker: produces a self-contained server in .next/standalone/
  output: "standalone",

  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
