import Link from 'next/link'
import { FileQuestion, Home, ArrowLeft } from 'lucide-react'

export default function GlobalNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 animate-fade-in">
      <div className="glass-card max-w-md w-full p-8 text-center space-y-6 border border-white/10">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
          <FileQuestion className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">Resource Not Found</h2>
          <p className="text-sm text-gray-300">
            The requested clinical registry, patient profile, or encounter record could not be found or has been moved.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/registry-home"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Registry Home
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-gray-200 font-medium text-xs transition-colors"
          >
            <Home className="w-3.5 h-3.5" /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
