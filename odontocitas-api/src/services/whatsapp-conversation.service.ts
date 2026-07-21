import { query, queryOne } from '../db/pool'

export type AccionChatbot = {
  accion?: string | null
  fecha_hora?: string | null
  fecha?: string | null
  tratamiento?: string | null
  especialidad?: string | null
  motivo?: string | null
}

export type ContextoWhatsapp = {
  pendiente?: boolean
  ultima_accion?: string | null
  datos?: AccionChatbot
  cita_id?: string | null
  slot_cita_id?: string | null
  admin_cita_ids?: string[]
}

const TTL_MINUTOS = 20

function limpiarValor<T>(valor: T | null | undefined): T | undefined {
  return valor == null || valor === '' ? undefined : valor
}

export function unirAcciones(previa: AccionChatbot | undefined, nueva: AccionChatbot): AccionChatbot {
  return {
    accion: limpiarValor(nueva.accion) ?? limpiarValor(previa?.accion) ?? null,
    fecha_hora: limpiarValor(nueva.fecha_hora) ?? limpiarValor(previa?.fecha_hora) ?? null,
    fecha: limpiarValor(nueva.fecha) ?? limpiarValor(previa?.fecha) ?? null,
    tratamiento: limpiarValor(nueva.tratamiento) ?? limpiarValor(previa?.tratamiento) ?? null,
    especialidad: limpiarValor(nueva.especialidad) ?? limpiarValor(previa?.especialidad) ?? null,
    motivo: limpiarValor(nueva.motivo) ?? limpiarValor(previa?.motivo) ?? null,
  }
}

export async function obtenerContextoWhatsapp(telefono: string): Promise<ContextoWhatsapp | null> {
  const row = await queryOne<{ contexto: ContextoWhatsapp }>(
    `SELECT contexto
     FROM whatsapp_conversaciones
     WHERE telefono = $1 AND expires_at > NOW()`,
    [telefono]
  )
  return row?.contexto ?? null
}

export async function guardarContextoWhatsapp(telefono: string, contexto: ContextoWhatsapp): Promise<void> {
  await query(
    `INSERT INTO whatsapp_conversaciones (telefono, contexto, expires_at, updated_at)
     VALUES ($1, $2::jsonb, NOW() + ($3 || ' minutes')::interval, NOW())
     ON CONFLICT (telefono)
     DO UPDATE SET contexto = EXCLUDED.contexto, expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
    [telefono, JSON.stringify(contexto), TTL_MINUTOS]
  )
}

export async function limpiarContextoWhatsapp(telefono: string): Promise<void> {
  await query('DELETE FROM whatsapp_conversaciones WHERE telefono = $1', [telefono])
}

export async function marcarMensajeWhatsappProcesado(mensajeId: string, telefono: string): Promise<boolean> {
  const insertado = await queryOne<{ mensaje_id: string }>(
    `INSERT INTO whatsapp_mensajes_procesados (mensaje_id, telefono)
     VALUES ($1, $2)
     ON CONFLICT (mensaje_id) DO NOTHING
     RETURNING mensaje_id`,
    [mensajeId, telefono]
  )
  return Boolean(insertado)
}

export async function limpiarMensajesWhatsappAntiguos(): Promise<void> {
  await query(
    `DELETE FROM whatsapp_mensajes_procesados
     WHERE created_at < NOW() - INTERVAL '2 days'`
  )
}
