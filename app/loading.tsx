export default function GlobalLoading() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 space-y-4 animate-fade-in">
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
        <div className="w-3 h-3 rounded-full bg-blue-500 absolute animate-ping" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-xs font-semibold text-gray-300 tracking-wider uppercase">Loading Clinical Registry</p>
        <p className="text-[11px] text-gray-400">Synchronizing records and clinical modules…</p>
      </div>
    </div>
  )
}
