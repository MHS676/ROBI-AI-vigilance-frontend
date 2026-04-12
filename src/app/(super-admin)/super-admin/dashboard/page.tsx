import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = { title: 'Command Center' };

/**
 * Server component shell — renders the interactive client dashboard.
 *
 * ssr: false — the dashboard is a real-time authenticated socket feed;
 * server-side rendering adds no value and causes React context errors
 * (useContext null) because socket.io-client and Zustand stores run
 * their module-level initialisation before React's dispatcher is set up
 * in the Turbopack SSR bundle.
 */
const SuperAdminDashboardClient = dynamic(
  () => import('./SuperAdminDashboardClient'),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-4 h-full animate-pulse">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 rounded-lg bg-slate-800" />
            <div className="h-4 w-72 rounded bg-slate-800/60" />
          </div>
          <div className="h-7 w-20 rounded-full bg-slate-800" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-800" />
          ))}
        </div>
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="flex-1 rounded-xl bg-slate-800/40" />
          <div className="w-72 rounded-xl bg-slate-800/40" />
          <div className="w-72 rounded-xl bg-slate-800/40" />
        </div>
      </div>
    ),
  },
);

export default function SuperAdminDashboardPage() {
  return <SuperAdminDashboardClient />;
}
