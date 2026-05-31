import './globals.css'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'iBzA FlyBuds — Arcade Flight | iBzA by TheLaraib',
  description:
    'iBzA FlyBuds — a fast, original arcade flight game. Tap to fly, dodge the obstacles, beat your high score. Part of the iBzA ecosystem by TheLaraib.',
  keywords: ['iBzA', 'FlyBuds', 'TheLaraib', 'flappy game', 'arcade game', 'browser game'],
}

export const viewport = {
  themeColor: '#050608',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
