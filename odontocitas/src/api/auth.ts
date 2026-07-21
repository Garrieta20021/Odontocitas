import { api, setToken, removeToken } from './client'
import type { UserRole } from '../context/AuthContext'

export interface LoginResponse {
  token: string
  user: {
    id: string
    perfilId: string | null
    cedula: string
    nombre: string
    email: string
    telefono: string
    rol: UserRole
    initials: string
  }
}

export function hasStoredSession(): boolean {
  return Boolean(localStorage.getItem('odontocitas_token') && localStorage.getItem('odontocitas_user'))
}

export async function loginAPI(cedula: string, password: string, rol: UserRole): Promise<LoginResponse> {
  removeToken()
  const res = await api.post<LoginResponse>('/auth/login', { cedula, password, rol })
  setToken(res.token)
  localStorage.setItem('odontocitas_user', JSON.stringify(res.user))
  return res
}

export function logoutAPI(): void {
  removeToken()
}

export function getStoredUser(): LoginResponse['user'] | null {
  try {
    const raw = localStorage.getItem('odontocitas_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
