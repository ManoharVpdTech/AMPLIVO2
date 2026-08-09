'use client';
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    // No-op unless a client DSN is configured (see sentry.client.config.ts).
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="font-inter antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9FAFB] px-6 text-center">
          <p className="text-sm font-semibold tracking-wide text-[#4C1D95]">500</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Something went wrong</h1>
          <p className="mt-3 max-w-md text-slate-600">
            An unexpected error occurred on our end. Please try again, or head back to the homepage.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-xl bg-[#4C1D95] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#3b1675]"
            >
              Try again
            </button>
            <Link
              href="/"
              className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-[#4C1D95] hover:text-[#4C1D95]"
            >
              Return Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
