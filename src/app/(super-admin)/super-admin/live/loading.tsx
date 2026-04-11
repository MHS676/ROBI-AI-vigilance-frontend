export default function LiveLoading() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800" />
        <div className="space-y-2">
          <div className="h-7 w-36 bg-slate-800 rounded-lg" />
          <div className="h-4 w-64 bg-slate-800/60 rounded" />
        </div>
      </div>
      <div className="flex-1 space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-800/50" />
        ))}
      </div>
    </div>
  );
}
