import { query } from '../db/pool'

export type TipoEventoWhatsapp =
  | 'mensaje_entrante'
  | 'cita_creada'
  | 'cita_cancelada'
  | 'cita_reprogramada'
  | 'cita_confirmada'
  | 'consulta_disponibilidad'

export async function registrarEventoWhatsapp(params: {
  telefono: string
  tipo: TipoEventoWhatsapp
  rol?: 'paciente' | 'admin' | 'odontologo' | 'desconocido'
  detalle?: Record<string, unknown>
}): Promise<void> {
  try {
    await query(
      `INSERT INTO whatsapp_eventos (telefono, rol, tipo, detalle)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        params.telefono,
        params.rol ?? 'desconocido',
        params.tipo,
        JSON.stringify(params.detalle ?? {}),
      ]
    )
  } catch (err) {
    console.error('No se pudo registrar evento WhatsApp:', err)
  }
}
