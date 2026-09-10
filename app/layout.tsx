import type { Metadata } from 'next'
import './globals.css'
import AppLayout from '@/components/layout/AppLayout'
import { Toaster } from 'sonner'
import { AppUserProvider } from '@/context/AppUserContext'

export const metadata: Metadata = {
  title: 'Cardio-Konnect Registry',
  description: 'Multi-site cardiovascular research registry — AICTS Pune & Kanpur Cardiac Apex Hospital.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppUserProvider>
          <AppLayout>{children}</AppLayout>
          <Toaster
            position="bottom-right"
            closeButton
            duration={5000}
            toastOptions={{
              style: {
                background: 'rgba(15, 26, 61, 0.95)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#e2e8f0',
                backdropFilter: 'blur(12px)',
              },
            }}
          />
        </AppUserProvider>
      </body>
    </html>
  )
}


