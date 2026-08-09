/**
 * Sentry client-side initialization (env-gated, inert without a DSN).
 *
 * In browser bundles NEXT_PUBLIC_* variables are inlined at build time, so a
 * missing DSN keeps the SDK uninitialized in development — no network calls,
 * no session tracking.
 */
"use client";

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    sendDefaultPii: false,
  });
}

export {}