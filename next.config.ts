import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Pages render in the browser once the local demo store has loaded, so there is nothing for the
  // automatic instant-navigation check to inspect yet. Revisit when data moves to Supabase.
  experimental: {
    instantInsights: { validationLevel: "manual-warning" },
  },
  partialPrefetching: true,
  // The PDF route drives a real browser; these load at run time instead of being bundled.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  images: {
    // Dish photos and logos uploaded to Supabase Storage.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
