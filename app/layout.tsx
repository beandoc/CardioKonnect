import type { Metadata } from 'next'
import './globals.css'
import AppLayout from '@/components/layout/AppLayout'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Cardio-Konnect Registry — AICTS Pune',
  description: 'State-of-the-art cardiovascular research registry for Dr. A. Jayachandra, AICTS Pune.',
}


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppLayout>{children}</AppLayout>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'rgba(15, 26, 61, 0.95)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#e2e8f0',
              backdropFilter: 'blur(12px)',
            },
          }}
        />
      </body>
    </html>
  )
}

