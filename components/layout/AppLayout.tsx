'use client'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  // On desktop, default to open; on mobile, default to collapsed
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  const toggleSidebar = () => setSidebarOpen(prev => !prev)
  const closeSidebar = () => setSidebarOpen(false)

  // Auto-collapse sidebar on mobile screen size on initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false)
      }
    }
  }, [])

  // Auto-collapse sidebar on route change for smaller screens
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [pathname])

  useEffect(() => {
    const auth = localStorage.getItem('cardiokonnect_auth') === 'true'
    setIsAuthenticated(auth)
    if (!auth && pathname !== '/login') {
      router.replace('/login')
    }
  }, [pathname, router])

  // If viewing the login page, render it directly without sidebar/topbar layouts
  if (pathname === '/login') {
    return <div className="min-h-screen bg-[#070e1b] text-gray-300">{children}</div>
  }

  // Prevent flash of guarded layout while auth status is being resolved
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#070e1b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-xs text-gray-500 tracking-wider uppercase font-semibold">Authorizing Session...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a1931] text-gray-300">
      {/* Backdrop overlay (mobile/tablet) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300" 
          onClick={closeSidebar}
          aria-label="Close sidebar overlay"
        />
      )}

      <div className="flex flex-1 relative">
        {/* Sidebar Component */}
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

        {/* Main Workspace Area — dynamically adjusts padding based on sidebarOpen */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out",
          sidebarOpen ? "lg:pl-[260px]" : "lg:pl-0"
        )}>
          <TopBar 
            sidebarOpen={sidebarOpen}
            onToggleSidebar={toggleSidebar} 
          />
          
          <main 
            onClick={() => {
              // If sidebar is open on mobile/tablet, clicking anywhere in main screen collapses it
              if (typeof window !== 'undefined' && window.innerWidth < 1024 && sidebarOpen) {
                closeSidebar()
              }
            }}
            className="flex-1 p-4 md:p-6 overflow-auto min-h-[calc(100vh-64px)]"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

