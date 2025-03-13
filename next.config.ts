import type { NextConfig } from "next";




const config = {
  serverExternalPackages: ["googleapis"],
};

const nextConfig: NextConfig = {
  ...config,
  /* config options here */
};

export default nextConfig;
