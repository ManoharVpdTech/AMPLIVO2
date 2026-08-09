/**
 * Next.js instrumentation hook — bootstraps Sentry for the server/edge
 * runtimes and captures request errors in App Router.
 *
 * Required by Next.js App Router; see
 * node_modules/next/dist/docs/01-app/02-guides/instrumentation.md.
 * Both imports no-op internally when their DSN is unset, so dev/test remain
 * untouched.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.server.config");
  }
}

// Capture errors from Server Components, route handlers, middleware, etc.
export const onRequestError = Sentry.captureRequestError;