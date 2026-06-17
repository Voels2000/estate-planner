import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

/** Mirror server-only signup flags into NEXT_PUBLIC_* at build time so client components hydrate. */
function publicWaitlistMode(): string {
  if (
    process.env.PUBLIC_SIGNUP_OPEN === "true" ||
    process.env.NEXT_PUBLIC_SIGNUP_OPEN === "true" ||
    process.env.WAITLIST_MODE === "false" ||
    process.env.NEXT_PUBLIC_WAITLIST_MODE === "false"
  ) {
    return "false";
  }
  if (
    process.env.WAITLIST_MODE === "true" ||
    process.env.NEXT_PUBLIC_WAITLIST_MODE === "true"
  ) {
    return "true";
  }
  return process.env.VERCEL_ENV === "production" ? "true" : "false";
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_WAITLIST_MODE: publicWaitlistMode(),
    NEXT_PUBLIC_SIGNUP_OPEN: process.env.PUBLIC_SIGNUP_OPEN === "true" ? "true" : "false",
  },
  async redirects() {
    return [
      {
        source: "/incapacity",
        destination: "/incapacity-planning",
        permanent: true,
      },
      {
        source: "/advisor/prospect",
        destination: "/prospect",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.resend.com",
              "frame-src https://js.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "mywealthmaps",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
