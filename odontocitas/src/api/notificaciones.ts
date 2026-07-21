import { api } from './client'

export interface Notificacion {
  id: string
  tipo: string
  titulo: string
  mensaje?: string
  descripcion: string
  estado: string
  leido: boolean
  cita_id?: string | null
  cita_estado?: string | null
  created_at?: string
  paciente_nombre?: string
  fecha_hora?: string
}

export interface ResumenNotificaciones {
  recordatorios: number
  confirmaciones: number
  solicitudes: number
  cancelaciones: number
  sin_leer: number
}

export const notificacionesAPI = {
  listar: () => api.get<Notificacion[]>('/notificaciones'),
  resumen: () => api.get<ResumenNotificaciones>('/notificaciones/resumen'),
  marcarLeido: (id: string) => api.patch<{ ok: boolean }>(`/notificaciones/${id}/leer`),
  marcarTodasLeidas: () => api.patch<{ ok: boolean }>('/notificaciones/leer-todas'),
  enviarRecordatorio: (data: { paciente_id: string; canal?: string; mensaje?: string }) =>
    api.post<{ ok: boolean }>('/notificaciones/recordatorio', data),
}
