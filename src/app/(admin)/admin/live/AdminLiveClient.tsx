'use client';

import { Activity } from 'lucide-react';
import LiveAlertsFeed from '@/components/dashboard/LiveAlertsFeed';

export default function AdminLiveClient() {
  return (
    <div className="flex flex-col h-full gap-5">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Activity className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Live Events</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time AI alerts from your center
          </p>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 min-h-0">
        <LiveAlertsFeed />
      </div>
    </div>
  );
}
