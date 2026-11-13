/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@valtherion/contracts",
    "@valtherion/domain",
    "@valtherion/rules-dnd2024",
  ],
  reactStrictMode: true,
};

export default nextConfig;
