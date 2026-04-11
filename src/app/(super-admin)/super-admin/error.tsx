'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

/**
 * Super-admin section error boundary.
 * Catches errors thrown in any /super-admin/* route segment
 * without crashing the entire app (sidebar + nav remain intact).
 */
export default function SuperAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[SuperAdminError]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-6 text-center p-8">
      <div className="w-14 h-14 rounded-2xl bg-red-400/10 border border-red-400/20 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-red-400" />
      </div>

      <div>
        <h2 className="text-xl font-bold text-white">Page error</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-sm">
          {error.message || 'An unexpected error occurred loading this page.'}
        </p>
        {error.digest && (
          <p className="text-xs text-slate-600 mt-2 font-mono">ID: {error.digest}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 text-red-400 rounded-xl text-sm font-medium transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
        <Link
          href="/super-admin/dashboard"
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
