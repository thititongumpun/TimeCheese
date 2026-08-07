import type { ComponentChildren } from 'preact'
import { useRef, useState } from 'preact/hooks'
import { Sidebar } from './Sidebar'
import packageJson from '../../package.json'

interface LayoutProps {
  children: ComponentChildren
}

export function Layout({ children }: LayoutProps) {
  const mainRef = useRef<HTMLElement>(null)
  const [showTop, setShowTop] = useState(false)

  return (
    <div class="drawer h-screen lg:drawer-open">
      <input id="app-drawer" type="checkbox" class="drawer-toggle" defaultChecked />
      <div class="drawer-content flex h-screen flex-col overflow-hidden bg-base-100">
        {/* Opens the drawer on small windows, where the sidebar is hidden instead of icon-only */}
        <label
          for="app-drawer"
          aria-label="Open sidebar"
          class="btn btn-square btn-ghost btn-sm fixed left-2 top-2 z-30 lg:hidden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-4 w-4"
          >
            <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" />
            <path d="M9 4v16" />
            <path d="M14 10l2 2l-2 2" />
          </svg>
        </label>
        <main
          ref={mainRef}
          class="relative flex-1 p-6 overflow-y-auto"
          onScroll={(e) => setShowTop(e.currentTarget.scrollTop > 300)}
        >
          {children}
          <footer class="mt-8 pt-4 text-center text-xs opacity-50">
            © {new Date().getFullYear()} TimeCheese · v{packageJson.version}
          </footer>
          {showTop && (
            <div class="aura aura-dual fixed bottom-20 right-6 z-30">
              <button
                class="btn btn-circle btn-primary shadow-lg"
                aria-label="Scroll to top"
                onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                ↑
              </button>
            </div>
          )}
        </main>
      </div>
      <div class="drawer-side z-40 is-drawer-close:overflow-visible">
        <label for="app-drawer" aria-label="Close sidebar" class="drawer-overlay" />
        <Sidebar />
      </div>
    </div>
  )
}
