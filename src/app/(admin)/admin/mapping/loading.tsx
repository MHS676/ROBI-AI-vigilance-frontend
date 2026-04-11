export default function MappingLoading() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      {/* Step breadcrumb */}
      <div className="flex items-center gap-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-800" />
            <div className="h-4 w-24 bg-slate-800 rounded" />
            {n < 3 && <div className="w-8 h-px bg-slate-800 mx-1" />}
          </div>
        ))}
      </div>
      {/* Canvas placeholder */}
      <div className="w-full max-w-3xl h-[450px] bg-slate-800/50 rounded-xl" />
      {/* Side panel */}
      <div className="h-48 w-80 bg-slate-800/40 rounded-xl" />
    </div>
  );
}
