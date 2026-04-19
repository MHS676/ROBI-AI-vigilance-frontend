import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Agent 360 Profile — Falcon Security',
  description: 'Aggregated agent intelligence: attendance, chair time, gossip alerts, and expression score.',
};

/**
 * Agent 360 Profile page.
 *
 * Rendered as a Server Component shell — the interactive client component
 * is dynamically imported with ssr:false because it depends on:
 *   • socket.io-client (browser-only)
 *   • Zustand stores (module-level initialisation)
 *   • SVG charts with browser layout metrics
 *
 * Route: /super-admin/agents/[id]
 */
const AgentProfileClient = dynamic(
  () => import('./AgentProfileClient'),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-4 max-w-6xl mx-auto">
        {/* Breadcrumb */}
        <div className="h-5 w-40 bg-slate-800 rounded" />

        {/* Top hero card */}
        <div className="h-40 bg-slate-800/50 rounded-2xl" />

        {/* Metrics grid */}
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-800 rounded-xl" />
          ))}
        </div>

        {/* Chair-time bar */}
        <div className="h-20 bg-slate-800/40 rounded-xl" />

        {/* Charts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="h-56 bg-slate-800/40 rounded-xl" />
          <div className="h-56 bg-slate-800/40 rounded-xl" />
        </div>

        {/* Lifetime stats */}
        <div className="h-24 bg-slate-800/30 rounded-xl" />
      </div>
    ),
  },
);

export default function AgentProfilePage() {
  return <AgentProfileClient />;
}
