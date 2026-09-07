/** @type {import('next').NextConfig} */
const nextConfig = {
  // Traces a minimal server bundle (only the deps actually used at runtime)
  // into .next/standalone — what the Docker image runs, so it doesn't need
  // the full node_modules copied in.
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "evolutecomsolutions.com" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default nextConfig;
