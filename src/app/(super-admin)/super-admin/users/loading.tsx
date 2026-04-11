// Users page loading skeleton — shown by Next.js App Router during navigation
export default function UsersLoading() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-52 bg-slate-800 rounded-lg" />
          <div className="h-4 w-72 bg-slate-800/60 rounded" />
        </div>
        <div className="h-9 w-24 bg-slate-800 rounded-lg" />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="h-9 flex-1 max-w-sm bg-slate-800 rounded-lg" />
        <div className="flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-24 bg-slate-800 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Table rows */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="h-10 bg-slate-900/60 border-b border-slate-800" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-slate-800/50 bg-slate-800/20 px-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 w-36 bg-slate-700 rounded" />
              <div className="h-3 w-48 bg-slate-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
