import { query } from '../db/pool'

export async function registrarAuditoria(params: {
  usuarioId?: string | null
  modulo: string
  accion: string
  entidad?: string
  entidadId?: string | null
  detalle?: Record<string, unknown>
}) {
  try {
    await query(
      `INSERT INTO auditoria (usuario_id, modulo, accion, entidad, entidad_id, detalle)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        params.usuarioId ?? null,
        params.modulo,
        params.accion,
        params.entidad ?? null,
        params.entidadId ?? null,
        JSON.stringify(params.detalle ?? {}),
      ]
    )
  } catch (err) {
    // La auditoría no debe bloquear la operación principal.
    console.error('No se pudo registrar auditoría:', err)
  }
}
