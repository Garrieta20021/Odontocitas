import type { UserRole } from '../context/AuthContext'

export const redirectMap: Record<UserRole, string> = {
  admin: '/admin/dashboard',
  odontologo: '/odontologo/agenda',
  paciente: '/paciente/portal',
}

const prefijoPorRol: Record<UserRole, string> = {
  admin: '/admin',
  odontologo: '/odontologo',
  paciente: '/paciente',
}

/** Tras login, solo reutiliza `from` si corresponde al rol elegido. */
export function destinoTrasLogin(rol: UserRole, fromPath?: string): string {
  const def = redirectMap[rol]
  if (!fromPath) return def
  if (fromPath.startsWith(prefijoPorRol[rol])) return fromPath
  return def
}
