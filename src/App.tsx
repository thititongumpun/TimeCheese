import { useEffect } from 'preact/hooks'
import { LocationProvider, Router, Route } from 'preact-iso'
import { supabase } from './lib/supabase'
import { currentUser, authLoading } from './store/auth'
import { startPresence, stopPresence } from './store/presence'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { Projects } from './pages/Projects'
import { Archived } from './pages/Archived'
import { Holiday } from './pages/Holiday'
import { Notes } from './pages/Notes'
import { Ask } from './pages/Ask'
import { Layout } from './components/Layout'

export function App() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      currentUser.value = user
      authLoading.value = false
      if (user) {
        startPresence({
          email: user.email ?? 'unknown',
          name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? (user.email ?? 'unknown').split('@')[0],
          avatar: user.user_metadata?.avatar_url,
        })
      } else {
        stopPresence()
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (authLoading.value) {
    return (
      <div class="min-h-screen flex items-center justify-center bg-base-100">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  if (!currentUser.value) {
    return <Login />
  }

  return (
    <LocationProvider>
      <Layout>
        <Router>
          <Route path="/" component={Home} />
          <Route path="/projects" component={Projects} />
          <Route path="/archived" component={Archived} />
          <Route path="/holiday" component={Holiday} />
          <Route path="/notes" component={Notes} />
          <Route path="/ask" component={Ask} />
        </Router>
      </Layout>
    </LocationProvider>
  )
}

export default App
