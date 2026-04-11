'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Admin Error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 py-20">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>
      <div className="text-center max-w-sm">
        <h2 className="text-lg font-semibold text-white">Something went wrong</h2>
        <p className="text-sm text-slate-400 mt-2">
          {error.message || 'An unexpected error occurred in this section.'}
        </p>
        {error.digest && (
          <p className="text-[10px] text-slate-600 mt-1 font-mono">ref: {error.digest}</p>
        )}
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-300 rounded-xl transition-all"
      >
        <RefreshCw className="w-4 h-4" />
        Try again
      </button>
    </div>
  );
}
