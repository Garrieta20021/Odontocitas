import { api } from './client'

export interface Factura {
  id: string
  numero: string
  cita_id: string | null
  paciente_nombre: string
  paciente_cedula: string
  tratamiento_nombre: string
  subtotal: number
  descuento: number
  total: number
  estado: string
  fecha_emision: string
  fecha_pago: string | null
  notas: string | null
  metodo_pago: string | null
  referencia_pago: string | null
  cufe: string | null
  qr_data: string | null
  resolucion_dian: string | null
}

export interface ResumenFacturacion {
  ingresos_mes: number
  pendiente_cobro: number
  total_facturas: number
  cartera_vencida: number
}

export const facturacionAPI = {
  listar: (params?: { estado?: string; cita_id?: string }) => api.get<Factura[]>('/facturas', params),
  resumen: () => api.get<ResumenFacturacion>('/facturas/resumen'),
  obtener: (id: string) => api.get<Factura>(`/facturas/${id}`),
  pagar: (id: string, data?: { metodo_pago?: string; referencia_pago?: string }) =>
    api.patch<Factura>(`/facturas/${id}/pagar`, data ?? {}),
  crear: (data: {
    cita_id: string
    paciente_id: string
    subtotal: number
    descuento?: number
    total: number
    notas?: string
    metodo_pago?: string
    referencia_pago?: string
  }) => api.post<Factura>('/facturas', data),
}
