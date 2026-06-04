'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LogsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/settings?tab=logs')
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400 text-sm">
      <div className="w-8 h-8 text-blue-500 animate-spin border-2 border-blue-500 border-t-transparent rounded-full" />
      <p>Redirecting to Event Logs...</p>
    </div>
  )
}

