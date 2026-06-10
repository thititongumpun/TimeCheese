import { useLocation } from 'preact-iso'
import { signOut } from '../services/auth'

export function Sidebar() {
  const { url } = useLocation()

  return (
    <aside class="w-48 min-h-screen bg-base-200 flex flex-col">
      <div class="p-4 font-bold text-xl text-primary">TimeSh1t</div>
      <nav class="flex-1 px-2">
        <ul class="menu menu-sm">
          <li>
            <a href="/" class={url === '/' ? 'active' : ''}>
              Home
            </a>
          </li>
          <li>
            <a href="/projects" class={url.startsWith('/projects') ? 'active' : ''}>
              Projects
            </a>
          </li>
        </ul>
      </nav>
      <div class="p-4">
        <button class="btn btn-ghost btn-sm w-full" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </aside>
  )
}
