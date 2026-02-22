import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mcp-servicenow"],
  devIndicators: false,
};

export default nextConfig;
