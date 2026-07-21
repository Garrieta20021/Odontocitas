import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { loginAPI, logoutAPI, getStoredUser, hasStoredSession } from '../api/auth'

export type UserRole = 'admin' | 'odontologo' | 'paciente'

export interface User {
  id: string
  perfilId: string | null
  nombre: string
  cedula: string
  email: string
  telefono: string
  rol: UserRole
  initials: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (cedula: string, password: string, rol: UserRole) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Restaurar sesión solo si hay token y usuario guardados.
  useEffect(() => {
    const stored = hasStoredSession() ? getStoredUser() : null
    if (stored) setUser(stored as User)
    setLoading(false)
  }, [])

  // Limpiar estado en memoria cuando el cliente invalida la sesión.
  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener('odontocitas:unauthorized', onUnauthorized)
    return () => window.removeEventListener('odontocitas:unauthorized', onUnauthorized)
  }, [])

  const login = useCallback(async (cedula: string, password: string, rol: UserRole): Promise<void> => {
    const res = await loginAPI(cedula, password, rol)
    setUser(res.user as User)
  }, [])

  const logout = useCallback(() => {
    logoutAPI()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
