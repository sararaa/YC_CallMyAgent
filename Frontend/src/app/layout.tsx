import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { ToastNotification } from '@/components/layout/ToastNotification'
import { WorkOrderModal } from '@/components/workorders/WorkOrderModal'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ChargePulse — EV Diagnostics',
  description: 'Real-time EV charger diagnostic call monitoring',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-bg-base text-white antialiased">
        <Navbar />
        <main className="flex-1 overflow-hidden">{children}</main>
        <ToastNotification />
        <WorkOrderModal />
      </body>
    </html>
  )
}
