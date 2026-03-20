import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import { Session, User, supabase } from '@/lib/supabase'
import { browserStorageAdapter } from '@/lib/storage'
import { STORAGE_KEYS } from '@/lib/constants'

interface AuthContextValue {
  session: Session | null
  user: User | null
  isLoading: boolean
  signInWithOtp: (email: string) => Promise<{ error: string | null }>
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Proactively refresh the session if it expires within 5 minutes
  const scheduleRefresh = useCallback((currentSession: Session | null) => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
      refreshIntervalRef.current = null
    }
    if (!currentSession) return

    refreshIntervalRef.current = setInterval(async () => {
      const expiresAt = currentSession.expires_at
      if (!expiresAt) return
      const msUntilExpiry = expiresAt * 1000 - Date.now()
      if (msUntilExpiry < 5 * 60 * 1000) {
        await supabase.auth.refreshSession()
      }
    }, 60_000)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      scheduleRefresh(s)
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      scheduleRefresh(s)
    })

    return () => {
      subscription.unsubscribe()
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
  }, [scheduleRefresh])

  const signInWithOtp = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    return { error: error ? error.message : null }
  }, [])

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })
    return { error: error ? error.message : null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    // Clear all app data from localStorage on sign out so a
    // different user on the same device cannot see this user's data
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('study-dashboard:')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => browserStorageAdapter.removeItem(key))
  }, [])

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      isLoading,
      signInWithOtp,
      verifyOtp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
