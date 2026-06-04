'use client'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { usePathname, useRouter } from 'next/navigation'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)
  const closeSidebar = () => setSidebarOpen(false)

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
      {/* Sidebar Overlay backdrop (mobile/tablet only) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-45 lg:hidden transition-opacity" 
          onClick={closeSidebar}
        />
      )}

      <div className="flex flex-1 relative">
        {/* Sidebar Component */}
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 lg:pl-[260px]">
          <TopBar onToggleSidebar={toggleSidebar} />
          
          <main className="flex-1 p-4 md:p-6 overflow-auto min-h-[calc(100vh-64px)]">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
