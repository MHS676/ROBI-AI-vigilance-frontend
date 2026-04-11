export default function CentersLoading() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 bg-slate-800 rounded-lg" />
          <div className="h-4 w-52 bg-slate-800/60 rounded" />
        </div>
        <div className="h-9 w-24 bg-slate-800 rounded-lg" />
      </div>
      <div className="flex gap-3">
        <div className="h-9 flex-1 max-w-xs bg-slate-800 rounded-lg" />
        <div className="h-9 w-48 bg-slate-800 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-slate-800/50" />
        ))}
      </div>
    </div>
  );
}
