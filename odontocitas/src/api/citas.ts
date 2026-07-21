import { api } from './client'

export interface Cita {
  id: string
  fecha_hora: string
  estado: string
  motivo: string | null
  notas_clinicas: string | null
  duracion_minutos: number
  paciente_nombre: string
  paciente_cedula: string
  paciente_id: string
  odontologo_nombre: string
  odontologo_id: string
  tratamiento_id: string
  tratamiento_nombre: string
  tarifa: number
}

export interface CitaPublica extends Cita {
  paciente_telefono?: string
  paciente_email?: string
  tratamiento_duracion?: number
}

export interface NuevaCitaPayload {
  paciente_id: string
  odontologo_id: string
  tratamiento_id: string
  fecha_hora: string
  motivo?: string
  duracion_minutos?: number
}

export const citasAPI = {
  listar: (params?: {
    estado?: string
    odontologo_id?: string
    paciente_id?: string
    fecha_desde?: string
    fecha_hasta?: string
    limit?: number
  }) => api.get<Cita[]>('/citas', params),

  hoy: () => api.get<Cita[]>('/citas/hoy'),

  obtener: (id: string) => api.get<Cita>(`/citas/${id}`),

  obtenerPublica: (token: string) => api.get<CitaPublica>(`/citas/publica/${token}`),

  crear: (data: NuevaCitaPayload) => api.post<Cita>('/citas', data),

  actualizar: (id: string, data: Partial<{
    estado: string
    notas_clinicas: string
    motivo_cancelacion: string
    fecha_hora: string
    odontologo_id: string
  }>) => api.patch<Cita>(`/citas/${id}`, data),

  confirmarPublica: (token: string) =>
    api.patch<Cita>(`/citas/publica/${token}/confirmar`, {}),

  cancelarPublica: (token: string) =>
    api.patch<Cita>(`/citas/publica/${token}/cancelar`, {}),

  // Cancelación por el propio paciente (o admin/odontólogo) de una cita autenticada.
  cancelarPropia: (id: string, motivo_cancelacion?: string) =>
    api.patch<Cita>(`/citas/${id}/cancelar`, { motivo_cancelacion }),

  // Reprogramación por el propio paciente (o admin/odontólogo). Valida
  // disponibilidad y deja la cita pendiente de aprobación del administrador.
  reprogramarPropia: (id: string, data: { fecha_hora: string; odontologo_id?: string }) =>
    api.patch<Cita>(`/citas/${id}/reprogramar`, data),

  cancelar: (id: string) => api.delete<{ message: string }>(`/citas/${id}`),
}
