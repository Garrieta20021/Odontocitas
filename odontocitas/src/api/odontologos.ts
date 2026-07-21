import { api } from './client'

export interface Odontologo {
  id: string
  usuario_id?: string
  nombre: string
  cedula: string
  email: string
  telefono: string
  especialidad: string
  color: string
  registro_profesional?: string | null
  activo?: boolean
  citas_semana: number
}

export interface HorarioDisponible {
  hora: string
  disponible: boolean
}

export type OdontologoPayload = {
  nombre: string
  cedula: string
  email: string
  telefono?: string
  especialidad: string
  color?: string
  registro_profesional?: string
}

export interface OdontologoCreado {
  id: string
  credenciales: { usuario: string; password_inicial: string; rol: string }
}

export const odontologosAPI = {
  listar: () => api.get<Odontologo[]>('/odontologos'),
  listarTodos: () => api.get<Odontologo[]>('/odontologos', { todos: 'true' }),
  disponibilidad: (id: string, fecha: string) =>
    api.get<HorarioDisponible[]>(`/odontologos/${id}/disponibilidad`, { fecha }),
  crear: (data: OdontologoPayload) => api.post<OdontologoCreado>('/odontologos', data),
  actualizar: (id: string, data: Omit<OdontologoPayload, 'cedula'>) =>
    api.put<{ message: string }>(`/odontologos/${id}`, data),
  cambiarActivo: (id: string, activo: boolean) =>
    api.patch<{ message: string }>(`/odontologos/${id}/activo`, { activo }),
}
