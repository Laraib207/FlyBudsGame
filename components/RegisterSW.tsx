'use client'

import { useEffect } from 'react'

// Registers the service worker so the game is installable + works offline.
export default function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const onLoad = () => navigator.serviceWorker.register('/sw.js').catch(() => {})
      window.addEventListener('load', onLoad)
      return () => window.removeEventListener('load', onLoad)
    }
  }, [])
  return null
}
