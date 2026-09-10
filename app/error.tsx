'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 animate-fade-in">
      <div className="glass-card max-w-md w-full p-8 text-center space-y-6 border border-rose-500/30">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">Clinical Application Error</h2>
          <p className="text-sm text-gray-300">
            An unexpected error occurred while processing this clinical view. Patient safety state remains preserved.
          </p>
          {error.digest && (
            <p className="text-xs font-mono text-gray-500">Error Digest: {error.digest}</p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Action
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-gray-200 font-medium text-xs transition-colors"
          >
            <Home className="w-3.5 h-3.5" /> Return Home
          </Link>
        </div>
      </div>
    </div>
  )
}
