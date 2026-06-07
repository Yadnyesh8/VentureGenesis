/** @type {import('next').NextConfig} */
const nextConfig = {
  // Off in dev so effects don't double-invoke and fire each (expensive) agent call twice.
  reactStrictMode: false,
  async rewrites() {
    const backend = process.env.BACKEND_URL || "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};
module.exports = nextConfig;
