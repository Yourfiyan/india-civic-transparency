export default function MapLegend() {
  return (
    <div className="absolute bottom-6 left-4 z-[1000] rounded-xl border border-slate-700/60 bg-slate-900/90 p-3 shadow-xl backdrop-blur-sm">
      <h4 className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Map Legend</h4>
      <div className="mt-2 space-y-1.5 text-[0.7rem]">
        <div>
          <span className="text-[0.6rem] font-medium text-slate-400">District Score</span>
          <div className="mt-0.5 flex h-2 w-36 overflow-hidden rounded">
            <div className="h-full w-1/3 bg-rose-500" title="Low (<40)" />
            <div className="h-full w-1/3 bg-amber-500" title="Medium (40-60)" />
            <div className="h-full w-1/3 bg-emerald-500" title="High (>60)" />
          </div>
          <div className="flex justify-between text-[0.55rem] text-slate-500">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-1.5">
          <span className="text-[0.6rem] font-medium text-slate-400">Infrastructure</span>
          <div className="mt-1 flex gap-3 text-[0.65rem]">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Done
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Active
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500" /> Planned
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
