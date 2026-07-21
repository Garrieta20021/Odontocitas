import { api } from './client'

export interface HorarioAtencion {
  dia: string
  desde: string
  hasta: string
  activo: boolean
}

export interface NotificacionesConfig {
  recordatorios_activos: boolean
  horas_anticipacion: number
  canal_email: boolean
  canal_sms: boolean
  canal_whatsapp: boolean
  resumen_diario: boolean
}

export interface IntegracionesConfig {
  email_remitente: string
  smtp_host: string
  whatsapp_numero: string
  pasarela_pago: string
}

export interface ConfiguracionGeneral {
  id: boolean
  nombre_clinica: string
  nit: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  ciudad: string | null
  horarios: HorarioAtencion[]
  notificaciones: NotificacionesConfig
  integraciones: IntegracionesConfig
  updated_at: string
}

export type ConfiguracionPayload = Omit<ConfiguracionGeneral, 'id' | 'updated_at'>

export const configuracionAPI = {
  obtener: () => api.get<ConfiguracionGeneral>('/configuracion'),
  actualizar: (data: ConfiguracionPayload) => api.put<ConfiguracionGeneral>('/configuracion', data),
}
