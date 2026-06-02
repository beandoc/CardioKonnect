'use client'
import { useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)
  const closeSidebar = () => setSidebarOpen(false)

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
