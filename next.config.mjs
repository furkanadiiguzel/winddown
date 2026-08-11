/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // playwright-core and its chromium-bidi sub-deps must never be bundled
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        "playwright-core",
        "@sparticuz/chromium",
        /^playwright-core\//,
        /^chromium-bidi\//,
      ];
    }
    return config;
  },
};

export default nextConfig;
