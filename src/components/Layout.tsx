import type { ComponentChildren } from 'preact'
import { useRef, useState } from 'preact/hooks'
import { Sidebar } from './Sidebar'
import { UpdateBadge } from './UpdateBadge'

interface LayoutProps {
  children: ComponentChildren
}

export function Layout({ children }: LayoutProps) {
  const mainRef = useRef<HTMLElement>(null)
  const [showTop, setShowTop] = useState(false)

  return (
    <div class="flex h-screen overflow-hidden bg-base-100">
      <UpdateBadge />
      <Sidebar />
      <main
        ref={mainRef}
        class="relative flex-1 p-6 overflow-y-auto"
        onScroll={(e) => setShowTop(e.currentTarget.scrollTop > 300)}
      >
        {children}
        {showTop && (
          <button
            class="btn btn-circle btn-primary fixed bottom-6 right-6 z-30 shadow-lg"
            aria-label="Scroll to top"
            onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            ↑
          </button>
        )}
      </main>
    </div>
  )
}
