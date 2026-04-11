export default function NewCenterLoading() {
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 animate-pulse">
      <div className="h-5 w-32 bg-slate-800 rounded" />
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-800" />
        <div className="space-y-2">
          <div className="h-7 w-56 bg-slate-800 rounded-lg" />
          <div className="h-4 w-72 bg-slate-800/60 rounded" />
        </div>
      </div>
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-4 w-32 bg-slate-800 rounded" />
            <div className="h-10 bg-slate-800/60 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
