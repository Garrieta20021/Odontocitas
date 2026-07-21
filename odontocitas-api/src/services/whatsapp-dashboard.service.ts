import { query, queryOne } from '../db/pool'

export type ConversacionActiva = {
  telefono: string
  nombre: string | null
  rol: string
  ultima_accion: string | null
  expira_en: string
  actualizado_en: string
}

export type CitaWhatsappReciente = {
  id: string
  fecha_hora: string
  estado: string
  paciente_nombre: string
  tratamiento_nombre: string | null
  tipo_evento: 'creada' | 'cancelada'
  evento_en: string
}

export type MetricasWhatsappDashboard = {
  periodo: { inicio: string; fin: string; etiqueta: string }
  conversaciones_activas: number
  citas_creadas: number
  citas_canceladas: number
  contactos_unicos: number
  tasa_conversion: number
  conversaciones: ConversacionActiva[]
  citas_recientes: CitaWhatsappReciente[]
}

function inicioMesColombia(): string {
  return `date_trunc('month', NOW() AT TIME ZONE 'America/Bogota')`
}

export async function metricasWhatsappDashboard(): Promise<MetricasWhatsappDashboard> {
  const periodo = await queryOne<{ inicio: string; fin: string; etiqueta: string }>(
    `SELECT
       (${inicioMesColombia()})::text AS inicio,
       ((${inicioMesColombia()}) + INTERVAL '1 month')::text AS fin,
       to_char(${inicioMesColombia()}, 'TMMonth YYYY') AS etiqueta`
  )

  const [
    activas,
    creadas,
    canceladas,
    contactos,
    conversiones,
    conversaciones,
    citasRecientes,
  ] = await Promise.all([
    queryOne<{ count: string }>(
      `SELECT COUNT(*)::int AS count
       FROM whatsapp_conversaciones
       WHERE expires_at > NOW()`
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*)::int AS count
       FROM whatsapp_eventos
       WHERE tipo = 'cita_creada'
       AND created_at >= ${inicioMesColombia()}`
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*)::int AS count
       FROM whatsapp_eventos
       WHERE tipo = 'cita_cancelada'
       AND created_at >= ${inicioMesColombia()}`
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(DISTINCT telefono)::int AS count
       FROM whatsapp_eventos
       WHERE tipo = 'mensaje_entrante'
       AND rol = 'paciente'
       AND created_at >= ${inicioMesColombia()}`
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(DISTINCT telefono)::int AS count
       FROM whatsapp_eventos
       WHERE tipo = 'cita_creada'
       AND created_at >= ${inicioMesColombia()}`
    ),
    query<ConversacionActiva>(
      `SELECT
         wc.telefono,
         COALESCE(up.nombre, ua.nombre) AS nombre,
         CASE
           WHEN ua.rol IN ('admin', 'odontologo') THEN ua.rol
           WHEN up.id IS NOT NULL THEN 'paciente'
           ELSE 'desconocido'
         END AS rol,
         wc.contexto->>'ultima_accion' AS ultima_accion,
         wc.expires_at::text AS expira_en,
         wc.updated_at::text AS actualizado_en
       FROM whatsapp_conversaciones wc
       LEFT JOIN usuarios ua ON regexp_replace(COALESCE(ua.telefono, ''), '\\D', '', 'g') IN (
         regexp_replace(wc.telefono, '\\D', '', 'g'),
         '57' || regexp_replace(wc.telefono, '\\D', '', 'g')
       ) AND ua.rol IN ('admin', 'odontologo')
       LEFT JOIN usuarios up ON regexp_replace(COALESCE(up.telefono, ''), '\\D', '', 'g') IN (
         regexp_replace(wc.telefono, '\\D', '', 'g'),
         '57' || regexp_replace(wc.telefono, '\\D', '', 'g')
       ) AND up.rol = 'paciente'
       WHERE wc.expires_at > NOW()
       ORDER BY wc.updated_at DESC
       LIMIT 12`
    ),
    query<CitaWhatsappReciente>(
      `SELECT
         c.id,
         c.fecha_hora::text,
         c.estado::text AS estado,
         u.nombre AS paciente_nombre,
         t.nombre AS tratamiento_nombre,
         CASE WHEN e.tipo = 'cita_creada' THEN 'creada' ELSE 'cancelada' END AS tipo_evento,
         e.created_at::text AS evento_en
       FROM whatsapp_eventos e
       JOIN citas c ON c.id::text = e.detalle->>'cita_id'
       JOIN pacientes p ON c.paciente_id = p.id
       JOIN usuarios u ON p.usuario_id = u.id
       LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
       WHERE e.tipo IN ('cita_creada', 'cita_cancelada')
       AND e.created_at >= ${inicioMesColombia()}
       ORDER BY e.created_at DESC
       LIMIT 10`
    ),
  ])

  const contactosUnicos = Number(contactos?.count ?? 0)
  const pacientesConvertidos = Number(conversiones?.count ?? 0)
  const tasaConversion = contactosUnicos > 0
    ? Math.round((pacientesConvertidos / contactosUnicos) * 1000) / 10
    : 0

  return {
    periodo: {
      inicio: periodo?.inicio ?? '',
      fin: periodo?.fin ?? '',
      etiqueta: periodo?.etiqueta ?? 'Este mes',
    },
    conversaciones_activas: Number(activas?.count ?? 0),
    citas_creadas: Number(creadas?.count ?? 0),
    citas_canceladas: Number(canceladas?.count ?? 0),
    contactos_unicos: contactosUnicos,
    tasa_conversion: tasaConversion,
    conversaciones,
    citas_recientes: citasRecientes,
  }
}
