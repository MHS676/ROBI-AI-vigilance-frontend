'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

/**
 * Global error boundary — catches unhandled errors anywhere in the app.
 * Next.js App Router requires this to be a Client Component.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to an error reporting service in production
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-950 text-white min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-400/10 border border-red-400/20 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
            <p className="text-slate-400 mt-2 text-sm">
              An unexpected error occurred. This has been logged automatically.
            </p>
            {error.digest && (
              <p className="text-xs text-slate-600 mt-2 font-mono">
                Error ID: {error.digest}
              </p>
            )}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 text-red-400 rounded-xl text-sm font-medium transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
            <Link
              href="/login"
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-all"
            >
              <Home className="w-4 h-4" />
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
