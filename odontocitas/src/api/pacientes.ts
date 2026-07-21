import { api } from './client'

export interface Paciente {
  id: string
  nombre: string
  cedula: string
  email: string
  telefono: string
  edad: number
  fecha_nacimiento: string
  grupo_sanguineo: string
  eps: string
  alergias: string[]
  enfermedades: string[]
  medicamentos: string
  activo: boolean
  total_citas: number
  ultima_visita: string | null
}

export interface NuevoPacientePayload {
  cedula: string
  nombre: string
  email: string
  telefono: string
  fecha_nacimiento?: string
  grupo_sanguineo?: string
  eps?: string
  alergias?: string[]
  enfermedades?: string[]
  medicamentos?: string
  password?: string
}

export interface HistoriaEntry {
  id: string
  cita_id: string | null
  fecha: string
  tratamiento_realizado: string
  hallazgos: string
  notas: string
  recomendaciones: string
  materiales_usados: string
  duracion_real: number
  odontologo_nombre: string
}

export interface DienteOdontograma {
  numero_diente: number
  estado: string
  notas: string | null
}

export interface PacienteCreado {
  id: string
  usuario_id: string
  nombre: string
  cedula: string
  email: string
  telefono: string
  credenciales: {
    usuario: string
    password_inicial: string
    password_personalizada?: boolean
    rol: string
  }
  message: string
}

export const pacientesAPI = {
  listar: (params?: { busqueda?: string; activo?: boolean }) =>
    api.get<Paciente[]>('/pacientes', params as Record<string, string | number | boolean | undefined>),

  obtener: (id: string) => api.get<Paciente>(`/pacientes/${id}`),

  crear: (data: NuevoPacientePayload) => api.post<PacienteCreado>('/pacientes', data),

  actualizar: (id: string, data: Partial<Paciente>) => api.put<Paciente>(`/pacientes/${id}`, data),

  eliminar: (id: string) => api.delete<{ message: string }>(`/pacientes/${id}`),

  historia: (id: string) => api.get<HistoriaEntry[]>(`/pacientes/${id}/historia`),

  odontograma: (id: string) => api.get<DienteOdontograma[]>(`/pacientes/${id}/odontograma`),

  agregarNota: (id: string, data: {
    cita_id?: string
    odontologo_id: string
    tratamiento_realizado: string
    hallazgos?: string
    notas?: string
    recomendaciones?: string
    materiales_usados?: string
    duracion_real?: number
  }) => api.post<HistoriaEntry>(`/pacientes/${id}/historia`, data),
}
