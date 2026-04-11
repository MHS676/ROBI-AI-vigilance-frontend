// Center detail page loading skeleton — shown during route transition
export default function CenterDetailLoading() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 w-48 bg-slate-800 rounded" />

      {/* Center header card */}
      <div className="card px-5 py-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-800" />
          <div className="space-y-2 flex-1">
            <div className="h-6 w-64 bg-slate-800 rounded-lg" />
            <div className="h-4 w-80 bg-slate-800/60 rounded" />
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800" />
            <div className="space-y-1.5">
              <div className="h-5 w-8 bg-slate-700 rounded" />
              <div className="h-3 w-16 bg-slate-800 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 w-28 bg-slate-800/50 rounded-t" />
        ))}
      </div>

      {/* Content area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 h-52" />
        <div className="card p-5 h-52" />
      </div>
    </div>
  );
}
