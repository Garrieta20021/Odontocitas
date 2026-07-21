import { api } from './client'

export interface Insumo {
  id: string
  nombre: string
  categoria: string
  stock_actual: number
  stock_minimo: number
  unidad: string
  proveedor: string
  precio_unitario: number | null
  fecha_vencimiento: string | null
  estado: string
}

export interface ResumenInventario {
  total_insumos: number
  stock_bajo: number
  por_vencer: number
  valor_total: number
}

export interface MovimientoInventario {
  id: string
  insumo_id: string | null
  insumo_nombre: string | null
  usuario_nombre: string | null
  tipo: 'entrada' | 'salida' | 'ajuste'
  cantidad: number
  stock_anterior: number | null
  stock_nuevo: number | null
  motivo: string | null
  created_at: string
}

export const inventarioAPI = {
  listar: (params?: { categoria?: string; busqueda?: string }) =>
    api.get<Insumo[]>('/inventario', params),
  resumen: () => api.get<ResumenInventario>('/inventario/resumen'),
  movimientos: (params?: { insumo_id?: string; limit?: number }) =>
    api.get<MovimientoInventario[]>('/inventario/movimientos', params),
  registrarMovimiento: (id: string, data: { tipo: 'entrada' | 'salida' | 'ajuste'; cantidad: number; motivo?: string }) =>
    api.post<Insumo>(`/inventario/${id}/movimiento`, data),
  crear: (data: Omit<Insumo, 'id' | 'estado'>) => api.post<Insumo>('/inventario', data),
  actualizar: (id: string, data: Partial<Insumo>) => api.patch<Insumo>(`/inventario/${id}`, data),
  eliminar: (id: string) => api.delete<{ message: string }>(`/inventario/${id}`),
}
