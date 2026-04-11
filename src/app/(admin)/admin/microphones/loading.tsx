export default function MicrophonesLoading() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-slate-800 rounded-lg" />
          <div className="h-4 w-48 bg-slate-800/60 rounded" />
        </div>
        <div className="h-9 w-24 bg-slate-800 rounded-lg" />
      </div>
      <div className="flex gap-3">
        <div className="h-9 flex-1 max-w-xs bg-slate-800 rounded-lg" />
        <div className="h-9 w-56 bg-slate-800 rounded-lg" />
      </div>
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 border-b border-slate-800/50 bg-slate-800/30" />
        ))}
      </div>
    </div>
  );
}
