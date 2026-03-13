import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.testnet.shelby.xyz",
      },
    ],
  },
};

export default nextConfig;