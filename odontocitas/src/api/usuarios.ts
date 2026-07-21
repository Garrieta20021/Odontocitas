import { api } from './client'

export interface Usuario {
  id: string
  cedula: string
  nombre: string
  email: string
  telefono: string | null
  rol: 'admin' | 'odontologo' | 'paciente'
  activo: boolean
  created_at: string
  updated_at: string
}

export const usuariosAPI = {
  listar: (rol?: string) => api.get<Usuario[]>('/usuarios', rol ? { rol } : undefined),
  cambiarActivo: (id: string, activo: boolean) =>
    api.patch<{ message: string }>(`/usuarios/${id}/activo`, { activo }),
  resetPassword: (id: string) =>
    api.post<{ message: string; password_inicial: string }>(`/usuarios/${id}/reset-password`, {}),
}
