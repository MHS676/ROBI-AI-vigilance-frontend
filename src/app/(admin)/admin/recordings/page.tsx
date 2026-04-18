import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Recordings | Falcon',
};

/**
 * Dynamic import with ssr: false prevents the React navigation context
 * (useRouter → useContext) from running during SSR, matching the pattern
 * used by super-admin/dashboard and other heavy client pages in this codebase.
 */
const RecordingsClient = dynamic(() => import('./RecordingsClient'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col gap-4 h-full animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-slate-800" />
      <div className="h-40 rounded-xl bg-slate-900 border border-slate-800" />
      <div className="flex-1 rounded-xl bg-slate-900 border border-slate-800" />
    </div>
  ),
});

export default function RecordingsPage() {
  return <RecordingsClient />;
}
