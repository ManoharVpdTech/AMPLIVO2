/**
 * Sentry server-side initialization (env-gated, inert without a DSN).
 *
 * Imported from src/instrumentation.ts for the Node.js runtime via Next.js
 * instrumentation hook. Only initializes when SENTRY_DSN is set — local/dev
 * and CI builds run completely untouched otherwise.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    // Privacy-first defaults: never auto-attach user info or request bodies.
    sendDefaultPii: false,
  });
}

export {};