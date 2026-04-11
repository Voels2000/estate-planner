import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/incapacity",
        destination: "/incapacity-planning",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
