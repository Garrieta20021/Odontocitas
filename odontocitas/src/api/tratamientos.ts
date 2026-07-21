import { api } from './client'

export interface Tratamiento {
  id: string
  nombre: string
  descripcion: string
  duracion_minutos: number
  tarifa: number
  especialidad: string
}

export type TratamientoPayload = {
  nombre: string
  descripcion?: string
  duracion_minutos: number
  tarifa: number
  especialidad: string
  activo?: boolean
}

export const tratamientosAPI = {
  listar: () => api.get<Tratamiento[]>('/tratamientos'),
  listarTodos: () => api.get<(Tratamiento & { activo: boolean })[]>('/tratamientos', { todos: 'true' }),
  crear: (data: TratamientoPayload) => api.post<Tratamiento>('/tratamientos', data),
  actualizar: (id: string, data: TratamientoPayload) => api.put<Tratamiento>(`/tratamientos/${id}`, data),
  eliminar: (id: string) => api.delete<{ message: string }>(`/tratamientos/${id}`),
}
