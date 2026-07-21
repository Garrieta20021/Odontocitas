import { api } from './client'

export interface Metricas {
  citas_hoy: number
  pacientes_activos: number
  ingresos_mes: number
  pendientes_confirmar: number
}

export interface ConversacionWhatsapp {
  telefono: string
  nombre: string | null
  rol: string
  ultima_accion: string | null
  expira_en: string
  actualizado_en: string
}

export interface CitaWhatsappReciente {
  id: string
  fecha_hora: string
  estado: string
  paciente_nombre: string
  tratamiento_nombre: string | null
  tipo_evento: 'creada' | 'cancelada'
  evento_en: string
}

export interface MetricasWhatsapp {
  periodo: { inicio: string; fin: string; etiqueta: string }
  conversaciones_activas: number
  citas_creadas: number
  citas_canceladas: number
  contactos_unicos: number
  tasa_conversion: number
  conversaciones: ConversacionWhatsapp[]
  citas_recientes: CitaWhatsappReciente[]
}

export interface TratamientoMes {
  nombre: string
  cantidad: number
}

export interface IngresoSemanal {
  semana: string
  ingresos: number
}

export interface CitasPorOdontologo {
  nombre: string
  citas: number
}

export interface MetricasPeriodo {
  ingresos: number
  citas_realizadas: number
  tasa_ausentismo: number
  nuevos_pacientes: number
}

export interface AusentismoDia {
  dia: string
  valor: number
}

export interface Cartera {
  cobrado: number
  pendiente: number
  vencida: number
}

export interface PuntoSeriePacientes {
  fecha: string
  pacientes: number
}

export interface PrediccionPacientes {
  serie: PuntoSeriePacientes[]
  ritmo_diario: number
  ultimos_7: number
  previos_7: number
  tendencia_pct: number
  proyeccion_7dias: number
  proyeccion_30dias: number
  realizado_mes_actual: number
  proyeccion_mes_actual: number
  metodo: string
  mensaje: string
}

export interface PuntoSerieIngresos {
  fecha: string
  ingresos: number
}

export interface PrediccionIngresos {
  serie: PuntoSerieIngresos[]
  ritmo_diario: number
  ultimos_7: number
  previos_7: number
  tendencia_pct: number
  proyeccion_7dias: number
  proyeccion_30dias: number
  realizado_mes_actual: number
  proyeccion_mes_actual: number
  metodo: string
  mensaje: string
}

export interface PrediccionEspecialidad {
  especialidad: string
  actual: number
  estimado: number
  tendencia_pct: number
  metodo: string
}

export interface RiesgoInasistencia {
  id: string
  fecha_hora: string
  paciente_nombre: string
  odontologo_nombre: string
  tratamiento_nombre: string | null
  probabilidad: number
  nivel: 'bajo' | 'medio' | 'alto'
  factores: string[]
}

export interface Reporte {
  periodo: { mes: string; inicio: string; fin: string }
  kpis: { actual: MetricasPeriodo; previo: MetricasPeriodo }
  ingresos_semanales: IngresoSemanal[]
  tratamientos: TratamientoMes[]
  citas_por_odontologo: CitasPorOdontologo[]
  ausentismo_por_dia: AusentismoDia[]
  cartera: Cartera
  prediccion_pacientes: PrediccionPacientes
  prediccion_ingresos: PrediccionIngresos
  prediccion_especialidades: PrediccionEspecialidad[]
  riesgo_inasistencia: RiesgoInasistencia[]
}

export const dashboardAPI = {
  metricas: () => api.get<Metricas>('/dashboard/metricas'),
  whatsapp: () => api.get<MetricasWhatsapp>('/dashboard/whatsapp'),
  citasHoy: () => api.get<unknown[]>('/dashboard/citas-hoy'),
  tratamientosMes: () => api.get<TratamientoMes[]>('/dashboard/tratamientos-mes'),
  ingresosSemanales: () => api.get<IngresoSemanal[]>('/dashboard/ingresos-semanales'),
  citasPorOdontologo: () => api.get<CitasPorOdontologo[]>('/dashboard/citas-odontologo'),
  reportes: (mes?: string) => api.get<Reporte>('/dashboard/reportes', mes ? { mes } : undefined),
}
