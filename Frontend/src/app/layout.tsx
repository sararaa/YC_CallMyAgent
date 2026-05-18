import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Geist_Mono } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { ToastNotification } from '@/components/layout/ToastNotification'
import { WorkOrderModal } from '@/components/workorders/WorkOrderModal'
import { WsBridge } from '@/lib/wsBridge'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'PigeonPlatform — Voice Intelligence',
  description: 'Real-time voice agent monitoring and diagnostics',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-bg-base text-text-primary antialiased">
        <WsBridge />
        <Navbar />
        <main className="flex-1 overflow-hidden">{children}</main>
        <ToastNotification />
        <WorkOrderModal />
      </body>
    </html>
  )
}
