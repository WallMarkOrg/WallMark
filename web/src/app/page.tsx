import { Suspense }   from 'react'
import { HomeClient } from './HomeClient'

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-slate-500 animate-pulse">Loading marketplace...</div>
      </div>
    }>
      <HomeClient />
    </Suspense>
  )
}
