import { query, queryOne } from '../db/pool'
import { notificarRespuestaCitaAlPaciente } from './notificaciones'
import { notificarConfirmacionCitaWhatsapp } from './citas.service'
import { enviarMensajeWhatsApp } from './whatsapp.service'
import {
  guardarContextoWhatsapp,
  limpiarContextoWhatsapp,
  obtenerContextoWhatsapp,
} from './whatsapp-conversation.service'

type UsuarioAdminWhatsapp = {
  id: string
  nombre: string
  rol: 'admin' | 'odontologo'
  telefono: string | null
  odontologo_id: string | null
}

export type ResultadoAdminWhatsapp = {
  atendido: boolean
  mensaje?: string
}

function normalizarTelefono(telefono: string): string {
  let limpio = String(telefono).replace(/\D/g, '')
  if (limpio.length > 10 && limpio.startsWith('57')) limpio = limpio.slice(2)
  return limpio
}

function normalizarTexto(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function formatearFecha(fecha: string): string {
  // Las citas se almacenan como hora de pared en UTC (igual que la app web).
  return new Date(fecha).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  })
}

function money(n: number): string {
  return `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`
}

export async function buscarUsuarioAdminPorTelefono(telefono: string): Promise<UsuarioAdminWhatsapp | null> {
  const tel = normalizarTelefono(telefono)
  return queryOne<UsuarioAdminWhatsapp>(
    `SELECT u.id, u.nombre, u.rol, u.telefono, od.id AS odontologo_id
     FROM usuarios u
     LEFT JOIN odontologos od ON od.usuario_id = u.id
     WHERE u.activo = true
     AND u.rol IN ('admin', 'odontologo')
     AND regexp_replace(COALESCE(u.telefono, ''), '\\D', '', 'g') IN ($1, '57' || $1)
     LIMIT 1`,
    [tel]
  )
}

function ayuda(usuario: UsuarioAdminWhatsapp): string {
  const nombre = usuario.nombre.split(' ')[0]
  const esAdmin = usuario.rol === 'admin'
  const lineas = [
    `Hola ${nombre} 👋 Soy el asistente administrativo de OdontoCitas.`,
    '',
    'Puedes preguntarme:',
    '📅 Agenda',
    '• "¿Cuántas citas tengo hoy?"',
    '• "¿Cuántas citas tengo mañana?"',
    '• "Mi próxima cita"',
  ]

  if (esAdmin) {
    lineas.push(
      '• "Citas pendientes de aprobación"',
      '• Después de "Citas pendientes": "aprobar 1" o "rechazar 1"',
      '',
      '💰 Finanzas',
      '• "Ingresos del día"',
      '• "Ingresos del mes"',
      '• "Facturas pendientes" / "cartera"',
      '',
      '👥 Pacientes',
      '• "Total de pacientes"',
      '• "Pacientes sin asistir en 12 meses"',
      '• "Buscar paciente Juan Pérez"',
      '',
      '📦 Inventario',
      '• "Insumos con stock bajo"',
      '',
      '📈 Estadísticas',
      '• "Tratamientos más frecuentes"',
      '• "Citas por estado esta semana"',
      '• "Ocupación por odontólogo"',
      '• "Citas canceladas de la semana"',
      '',
      '🎂 Seguimiento',
      '• "Cumpleaños próximos"'
    )
  } else {
    lineas.push(
      '',
      '👥 Pacientes',
      '• "Buscar paciente Juan Pérez"'
    )
  }

  lineas.push('', 'Responderé con datos rápidos para gestión clínica.')
  return lineas.join('\n')
}

async function citasDeHoy(usuario: UsuarioAdminWhatsapp): Promise<string> {
  const params: unknown[] = []
  let filtroOdontologo = ''
  if (usuario.rol === 'odontologo' && usuario.odontologo_id) {
    params.push(usuario.odontologo_id)
    filtroOdontologo = `AND c.odontologo_id = $${params.length}`
  }

  const citas = await query<{
    fecha_hora: string
    estado: string
    paciente_nombre: string
    odontologo_nombre: string
    tratamiento_nombre: string | null
  }>(
    `SELECT c.fecha_hora, c.estado,
            up.nombre AS paciente_nombre,
            uo.nombre AS odontologo_nombre,
            t.nombre AS tratamiento_nombre
     FROM citas c
     JOIN pacientes p ON c.paciente_id = p.id
     JOIN usuarios up ON p.usuario_id = up.id
     JOIN odontologos od ON c.odontologo_id = od.id
     JOIN usuarios uo ON od.usuario_id = uo.id
     LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
     WHERE DATE(c.fecha_hora) =
           DATE(NOW() AT TIME ZONE 'America/Bogota')
     AND c.estado != 'cancelada'
     ${filtroOdontologo}
     ORDER BY c.fecha_hora ASC
     LIMIT 15`,
    params
  )

  if (citas.length === 0) return 'No hay citas programadas para hoy.'

  const resumen = citas
    .map((c, i) => {
      const tratamiento = c.tratamiento_nombre ?? 'atención odontológica'
      const doctor = usuario.rol === 'admin' ? ` · ${c.odontologo_nombre}` : ''
      return `${i + 1}. ${formatearFecha(c.fecha_hora)} · ${c.paciente_nombre} · ${tratamiento}${doctor} (${c.estado})`
    })
    .join('\n')

  return `Hoy hay ${citas.length} cita(s):\n\n${resumen}`
}

async function proximaCita(usuario: UsuarioAdminWhatsapp): Promise<string> {
  const params: unknown[] = []
  let filtroOdontologo = ''
  if (usuario.rol === 'odontologo' && usuario.odontologo_id) {
    params.push(usuario.odontologo_id)
    filtroOdontologo = `AND c.odontologo_id = $${params.length}`
  }

  const cita = await queryOne<{
    fecha_hora: string
    estado: string
    paciente_nombre: string
    paciente_telefono: string | null
    odontologo_nombre: string
    tratamiento_nombre: string | null
  }>(
    `SELECT c.fecha_hora, c.estado,
            up.nombre AS paciente_nombre,
            uo.nombre AS odontologo_nombre,
            t.nombre AS tratamiento_nombre
     FROM citas c
     JOIN pacientes p ON c.paciente_id = p.id
     JOIN usuarios up ON p.usuario_id = up.id
     JOIN odontologos od ON c.odontologo_id = od.id
     JOIN usuarios uo ON od.usuario_id = uo.id
     LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
     WHERE c.fecha_hora >= NOW()
     AND c.estado NOT IN ('cancelada', 'completada')
     ${filtroOdontologo}
     ORDER BY c.fecha_hora ASC
     LIMIT 1`,
    params
  )

  if (!cita) return 'No tienes citas próximas programadas.'

  const tratamiento = cita.tratamiento_nombre ?? 'atención odontológica'
  const doctor = usuario.rol === 'admin' ? `\n👨‍⚕️ ${cita.odontologo_nombre}` : ''
  return `Tu próxima cita:\n\n🗓️ ${formatearFecha(cita.fecha_hora)}\n🧑 ${cita.paciente_nombre}\n🦷 ${tratamiento}${doctor}\nEstado: ${cita.estado}`
}

async function ingresosDelDia(): Promise<string> {
  const fila = await queryOne<{ total: string; cantidad: string }>(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS cantidad
     FROM facturas
     WHERE estado = 'pagada'
     AND fecha_pago IS NOT NULL
     AND DATE(fecha_pago AT TIME ZONE 'America/Bogota') =
         DATE(NOW() AT TIME ZONE 'America/Bogota')`
  )
  const total = Number(fila?.total ?? 0)
  const cantidad = Number(fila?.cantidad ?? 0)
  return `Ingresos de hoy: ${money(total)} (${cantidad} factura(s) pagada(s)).`
}

async function ingresosDelMes(): Promise<string> {
  const fila = await queryOne<{ total: string; cantidad: string }>(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS cantidad
     FROM facturas
     WHERE estado = 'pagada'
     AND fecha_pago IS NOT NULL
     AND date_trunc('month', fecha_pago AT TIME ZONE 'America/Bogota') =
         date_trunc('month', NOW() AT TIME ZONE 'America/Bogota')`
  )
  const total = Number(fila?.total ?? 0)
  const cantidad = Number(fila?.cantidad ?? 0)
  return `Ingresos del mes: ${money(total)} (${cantidad} factura(s) pagada(s)).`
}

async function facturasPendientes(): Promise<string> {
  const fila = await queryOne<{ total: string; cantidad: string }>(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS cantidad
     FROM facturas
     WHERE estado IN ('pendiente', 'vencida')`
  )
  const total = Number(fila?.total ?? 0)
  const cantidad = Number(fila?.cantidad ?? 0)
  if (cantidad === 0) return 'No hay facturas pendientes de pago. 🎉'

  const detalle = await query<{ numero: string; total: string; paciente_nombre: string }>(
    `SELECT f.numero, f.total, u.nombre AS paciente_nombre
     FROM facturas f
     JOIN pacientes p ON f.paciente_id = p.id
     JOIN usuarios u ON p.usuario_id = u.id
     WHERE f.estado IN ('pendiente', 'vencida')
     ORDER BY f.fecha_emision ASC
     LIMIT 8`
  )

  const lista = detalle
    .map((f, i) => `${i + 1}. ${f.numero} · ${f.paciente_nombre} · ${money(Number(f.total))}`)
    .join('\n')

  return `Cartera pendiente: ${money(total)} en ${cantidad} factura(s).\n\n${lista}`
}

async function totalPacientes(): Promise<string> {
  const fila = await queryOne<{ total: string; nuevos: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE p.activo = true) AS total,
       COUNT(*) FILTER (
         WHERE p.activo = true
         AND date_trunc('month', p.created_at AT TIME ZONE 'America/Bogota') =
             date_trunc('month', NOW() AT TIME ZONE 'America/Bogota')
       ) AS nuevos
     FROM pacientes p`
  )
  const total = Number(fila?.total ?? 0)
  const nuevos = Number(fila?.nuevos ?? 0)
  return `Pacientes activos: ${total}.\nNuevos este mes: ${nuevos}.`
}

async function insumosStockBajo(): Promise<string> {
  const items = await query<{ nombre: string; stock_actual: number; stock_minimo: number; unidad: string | null }>(
    `SELECT nombre, stock_actual, stock_minimo, unidad
     FROM insumos
     WHERE stock_actual <= stock_minimo
     ORDER BY (stock_actual - stock_minimo) ASC, nombre ASC
     LIMIT 12`
  )

  if (items.length === 0) return 'Todo el inventario está por encima del stock mínimo. 👍'

  const lista = items
    .map((it, i) => `${i + 1}. ${it.nombre} · ${it.stock_actual} ${it.unidad ?? ''} (mín. ${it.stock_minimo})`)
    .join('\n')

  return `Insumos con stock bajo (${items.length}):\n\n${lista}`
}

async function tratamientosFrecuentes(): Promise<string> {
  const items = await query<{ nombre: string; cantidad: string }>(
    `SELECT COALESCE(t.nombre, 'Sin tratamiento') AS nombre, COUNT(*) AS cantidad
     FROM citas c
     LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
     WHERE c.estado = 'completada'
     AND date_trunc('month', c.fecha_hora) =
         date_trunc('month', NOW() AT TIME ZONE 'America/Bogota')
     GROUP BY t.nombre
     ORDER BY COUNT(*) DESC
     LIMIT 8`
  )

  if (items.length === 0) return 'Aún no hay tratamientos completados este mes.'

  const lista = items
    .map((it, i) => `${i + 1}. ${it.nombre} · ${it.cantidad} cita(s)`)
    .join('\n')

  return `Tratamientos más frecuentes este mes:\n\n${lista}`
}

async function citasPorEstadoSemana(): Promise<string> {
  const items = await query<{ estado: string; cantidad: string }>(
    `SELECT c.estado::text AS estado, COUNT(*) AS cantidad
     FROM citas c
     WHERE DATE(c.fecha_hora) >=
           DATE(date_trunc('week', NOW() AT TIME ZONE 'America/Bogota'))
     AND DATE(c.fecha_hora) <
           DATE(date_trunc('week', NOW() AT TIME ZONE 'America/Bogota') + INTERVAL '7 days')
     GROUP BY c.estado
     ORDER BY COUNT(*) DESC`
  )

  if (items.length === 0) return 'No hay citas registradas para esta semana.'

  const total = items.reduce((sum, item) => sum + Number(item.cantidad), 0)
  const lista = items
    .map((item) => `• ${item.estado}: ${item.cantidad}`)
    .join('\n')

  return `Citas de esta semana: ${total}\n\n${lista}`
}

async function ocupacionPorOdontologo(): Promise<string> {
  const items = await query<{
    odontologo_nombre: string
    citas: string
    minutos: string
  }>(
    `SELECT u.nombre AS odontologo_nombre,
            COUNT(c.id) AS citas,
            COALESCE(SUM(c.duracion_minutos), 0) AS minutos
     FROM odontologos od
     JOIN usuarios u ON od.usuario_id = u.id
     LEFT JOIN citas c ON c.odontologo_id = od.id
       AND c.estado NOT IN ('cancelada')
       AND DATE(c.fecha_hora) >=
           DATE(date_trunc('week', NOW() AT TIME ZONE 'America/Bogota'))
       AND DATE(c.fecha_hora) <
           DATE(date_trunc('week', NOW() AT TIME ZONE 'America/Bogota') + INTERVAL '7 days')
     WHERE u.activo = true
     GROUP BY u.nombre
     ORDER BY COALESCE(SUM(c.duracion_minutos), 0) DESC, u.nombre ASC
     LIMIT 10`
  )

  if (items.length === 0) return 'No encontré odontólogos activos.'

  const minutosLaboralesSemana = 5 * 9 * 60
  const lista = items
    .map((item, i) => {
      const minutos = Number(item.minutos)
      const porcentaje = Math.min(100, Math.round((minutos / minutosLaboralesSemana) * 100))
      return `${i + 1}. ${item.odontologo_nombre} · ${item.citas} cita(s) · ${porcentaje}% de ocupación estimada`
    })
    .join('\n')

  return `Ocupación estimada por odontólogo esta semana:\n\n${lista}`
}

async function citasCanceladasSemana(): Promise<string> {
  const citas = await query<{
    fecha_hora: string
    estado: string
    paciente_nombre: string
    odontologo_nombre: string
    motivo_cancelacion: string | null
  }>(
    `SELECT c.fecha_hora, c.estado,
            up.nombre AS paciente_nombre,
            uo.nombre AS odontologo_nombre,
            c.motivo_cancelacion
     FROM citas c
     JOIN pacientes p ON c.paciente_id = p.id
     JOIN usuarios up ON p.usuario_id = up.id
     JOIN odontologos od ON c.odontologo_id = od.id
     JOIN usuarios uo ON od.usuario_id = uo.id
     WHERE c.estado IN ('cancelada', 'reprogramada')
     AND DATE(c.fecha_hora) >=
         DATE(date_trunc('week', NOW() AT TIME ZONE 'America/Bogota'))
     AND DATE(c.fecha_hora) <
         DATE(date_trunc('week', NOW() AT TIME ZONE 'America/Bogota') + INTERVAL '7 days')
     ORDER BY c.fecha_hora DESC
     LIMIT 10`
  )

  if (citas.length === 0) return 'No hay citas canceladas o reprogramadas esta semana.'

  const lista = citas
    .map((c, i) => {
      const motivo = c.motivo_cancelacion ? ` · Motivo: ${c.motivo_cancelacion}` : ''
      return `${i + 1}. ${formatearFecha(c.fecha_hora)} · ${c.paciente_nombre} · ${c.odontologo_nombre} (${c.estado})${motivo}`
    })
    .join('\n')

  return `Citas canceladas/reprogramadas esta semana:\n\n${lista}`
}

async function cumpleanosProximos(): Promise<string> {
  const pacientes = await query<{
    nombre: string
    telefono: string | null
    proximo_cumple: string
  }>(
    `WITH cumple AS (
       SELECT u.nombre, u.telefono,
              CASE
                WHEN make_date(EXTRACT(YEAR FROM NOW())::int, EXTRACT(MONTH FROM p.fecha_nacimiento)::int, EXTRACT(DAY FROM p.fecha_nacimiento)::int)
                     < DATE(NOW() AT TIME ZONE 'America/Bogota')
                THEN make_date(EXTRACT(YEAR FROM NOW())::int + 1, EXTRACT(MONTH FROM p.fecha_nacimiento)::int, EXTRACT(DAY FROM p.fecha_nacimiento)::int)
                ELSE make_date(EXTRACT(YEAR FROM NOW())::int, EXTRACT(MONTH FROM p.fecha_nacimiento)::int, EXTRACT(DAY FROM p.fecha_nacimiento)::int)
              END AS proximo_cumple
       FROM pacientes p
       JOIN usuarios u ON p.usuario_id = u.id
       WHERE p.activo = true
       AND p.fecha_nacimiento IS NOT NULL
     )
     SELECT nombre, telefono, proximo_cumple::text
     FROM cumple
     WHERE proximo_cumple <= DATE(NOW() AT TIME ZONE 'America/Bogota') + INTERVAL '30 days'
     ORDER BY proximo_cumple ASC, nombre ASC
     LIMIT 10`
  )

  if (pacientes.length === 0) return 'No hay cumpleaños de pacientes en los próximos 30 días.'

  const lista = pacientes
    .map((p, i) => `${i + 1}. ${p.nombre} · ${new Date(p.proximo_cumple).toLocaleDateString('es-CO')}${p.telefono ? ` · ${p.telefono}` : ''}`)
    .join('\n')

  return `Cumpleaños próximos:\n\n${lista}`
}

async function buscarPaciente(textoOriginal: string): Promise<string> {
  const criterio = textoOriginal
    .replace(/.*\b(buscar|busca|paciente|cliente|datos de|informacion de|información de)\b/i, '')
    .replace(/[?¿!¡.]/g, '')
    .trim()

  if (criterio.length < 2) {
    return 'Indícame el nombre o la cédula del paciente. Ej: "Buscar paciente Juan Pérez".'
  }

  const like = `%${criterio}%`
  const pacientes = await query<{
    nombre: string
    cedula: string | null
    telefono: string | null
    email: string | null
    ultima_visita: string | null
    citas_activas: string
  }>(
    `SELECT u.nombre, u.cedula, u.telefono, u.email,
            MAX(c.fecha_hora) FILTER (WHERE c.estado = 'completada') AS ultima_visita,
            COUNT(c.id) FILTER (WHERE c.estado NOT IN ('cancelada', 'completada') AND c.fecha_hora >= NOW()) AS citas_activas
     FROM pacientes p
     JOIN usuarios u ON p.usuario_id = u.id
     LEFT JOIN citas c ON c.paciente_id = p.id
     WHERE u.nombre ILIKE $1 OR COALESCE(u.cedula, '') ILIKE $1
     GROUP BY u.nombre, u.cedula, u.telefono, u.email
     ORDER BY u.nombre ASC
     LIMIT 5`,
    [like]
  )

  if (pacientes.length === 0) return `No encontré pacientes que coincidan con "${criterio}".`

  const lista = pacientes
    .map((p) => {
      const ultima = p.ultima_visita ? formatearFecha(p.ultima_visita) : 'sin visitas'
      const datos = [
        `👤 ${p.nombre}`,
        p.cedula ? `🪪 ${p.cedula}` : null,
        p.telefono ? `📞 ${p.telefono}` : null,
        p.email ? `✉️ ${p.email}` : null,
        `🗓️ Última visita: ${ultima}`,
        `📌 Citas activas: ${Number(p.citas_activas)}`,
      ]
        .filter(Boolean)
        .join('\n')
      return datos
    })
    .join('\n\n')

  return pacientes.length === 1
    ? lista
    : `Encontré ${pacientes.length} pacientes:\n\n${lista}`
}

async function resumenManiana(usuario: UsuarioAdminWhatsapp): Promise<string> {
  const params: unknown[] = []
  let filtroOdontologo = ''
  if (usuario.rol === 'odontologo' && usuario.odontologo_id) {
    params.push(usuario.odontologo_id)
    filtroOdontologo = `AND c.odontologo_id = $${params.length}`
  }

  const citas = await query<{
    fecha_hora: string
    estado: string
    paciente_nombre: string
    odontologo_nombre: string
    tratamiento_nombre: string | null
  }>(
    `SELECT c.fecha_hora, c.estado,
            up.nombre AS paciente_nombre,
            uo.nombre AS odontologo_nombre,
            t.nombre AS tratamiento_nombre
     FROM citas c
     JOIN pacientes p ON c.paciente_id = p.id
     JOIN usuarios up ON p.usuario_id = up.id
     JOIN odontologos od ON c.odontologo_id = od.id
     JOIN usuarios uo ON od.usuario_id = uo.id
     LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
     WHERE DATE(c.fecha_hora) =
           (DATE(NOW() AT TIME ZONE 'America/Bogota') + INTERVAL '1 day')
     AND c.estado != 'cancelada'
     ${filtroOdontologo}
     ORDER BY c.fecha_hora ASC
     LIMIT 12`,
    params
  )

  if (citas.length === 0) return 'No hay citas programadas para mañana.'

  const resumen = citas
    .map((c, i) => {
      const tratamiento = c.tratamiento_nombre ?? 'atención odontológica'
      const doctor = usuario.rol === 'admin' ? ` · ${c.odontologo_nombre}` : ''
      return `${i + 1}. ${formatearFecha(c.fecha_hora)} · ${c.paciente_nombre} · ${tratamiento}${doctor} (${c.estado})`
    })
    .join('\n')

  return `Mañana hay ${citas.length} cita(s):\n\n${resumen}`
}

async function pendientesAprobacion(telefono: string): Promise<string> {
  const citas = await query<{
    id: string
    fecha_hora: string
    paciente_nombre: string
    odontologo_nombre: string
    tratamiento_nombre: string | null
  }>(
    `SELECT c.id, c.fecha_hora,
            up.nombre AS paciente_nombre,
            uo.nombre AS odontologo_nombre,
            t.nombre AS tratamiento_nombre
     FROM citas c
     JOIN pacientes p ON c.paciente_id = p.id
     JOIN usuarios up ON p.usuario_id = up.id
     JOIN odontologos od ON c.odontologo_id = od.id
     JOIN usuarios uo ON od.usuario_id = uo.id
     LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
     WHERE c.estado IN ('pendiente', 'reprogramada')
     AND c.fecha_hora >= NOW()
     ORDER BY c.fecha_hora ASC
     LIMIT 12`
  )

  if (citas.length === 0) {
    await limpiarContextoWhatsapp(telefono)
    return 'No hay citas pendientes ni reprogramadas de aprobación.'
  }

  await guardarContextoWhatsapp(telefono, {
    pendiente: true,
    ultima_accion: 'admin_aprobar_citas',
    admin_cita_ids: citas.map((c) => c.id),
  })

  const resumen = citas
    .map((c, i) => `${i + 1}. ${formatearFecha(c.fecha_hora)} · ${c.paciente_nombre} · ${c.tratamiento_nombre ?? 'atención'} · ${c.odontologo_nombre}`)
    .join('\n')

  return `Hay ${citas.length} cita(s) por aprobar (nuevas o reprogramadas):\n\n${resumen}\n\nPuedes responder: "aprobar 1" o "rechazar 1".`
}

async function responderDecisionCitaAdmin(
  telefono: string,
  texto: string
): Promise<string | null> {
  const contexto = await obtenerContextoWhatsapp(telefono)
  if (contexto?.ultima_accion !== 'admin_aprobar_citas' || !contexto.admin_cita_ids?.length) {
    return null
  }

  const t = normalizarTexto(texto)
  const match = t.match(/\b(aprobar|aceptar|confirmar|rechazar|cancelar|negar)\s+(?:cita\s+)?(\d{1,2})\b/)
  if (!match) {
    if (/(aprobar|aceptar|confirmar|rechazar|cancelar|negar)/.test(t)) {
      return 'Indica el número de la cita. Ej: "aprobar 1" o "rechazar 2".'
    }
    return null
  }

  const accion = match[1]
  const indice = Number(match[2]) - 1
  const citaId = contexto.admin_cita_ids[indice]
  if (!citaId) {
    return `No tengo una cita con ese número en la lista actual. Escribe "citas pendientes" para ver la lista actualizada.`
  }

  const aprobar = /(aprobar|aceptar|confirmar)/.test(accion)
  const cita = await queryOne<{
    id: string
    fecha_hora: string
    estado: string
    paciente_nombre: string
    paciente_telefono: string | null
    odontologo_nombre: string
    tratamiento_nombre: string | null
  }>(
    `WITH actualizada AS (
       UPDATE citas
       SET estado = $2,
           motivo_cancelacion = CASE WHEN $2 = 'cancelada' THEN 'Rechazada por administración vía WhatsApp' ELSE motivo_cancelacion END,
           confirmado_en = CASE WHEN $2 = 'confirmada' THEN NOW() ELSE confirmado_en END,
           updated_at = NOW()
       WHERE id = $1
       AND estado IN ('pendiente', 'reprogramada')
       RETURNING *
     )
     SELECT c.id, c.fecha_hora, c.estado::text AS estado,
            up.nombre AS paciente_nombre,
            up.telefono AS paciente_telefono,
            uo.nombre AS odontologo_nombre,
            t.nombre AS tratamiento_nombre
     FROM actualizada c
     JOIN pacientes p ON c.paciente_id = p.id
     JOIN usuarios up ON p.usuario_id = up.id
     JOIN odontologos od ON c.odontologo_id = od.id
     JOIN usuarios uo ON od.usuario_id = uo.id
     LEFT JOIN tratamientos t ON c.tratamiento_id = t.id`,
    [citaId, aprobar ? 'confirmada' : 'cancelada']
  )

  if (!cita) {
    return 'Esa cita ya no está pendiente o no existe. Escribe "citas pendientes" para actualizar la lista.'
  }

  try {
    await notificarRespuestaCitaAlPaciente(cita.id, cita.estado)
    if (aprobar) {
      await notificarConfirmacionCitaWhatsapp(cita.id)
    } else if (cita.paciente_telefono) {
      const numero = cita.paciente_telefono.replace(/\D/g, '')
      const destino = numero.length === 10 ? `57${numero}` : numero
      await enviarMensajeWhatsApp(
        destino,
        `Hola ${cita.paciente_nombre.split(' ')[0]}. Tu solicitud de cita para el ${formatearFecha(cita.fecha_hora)} fue rechazada por la clínica. Puedes escribirnos para solicitar una nueva fecha.`
      )
    }
  } catch (err) {
    console.error('No se pudo notificar la decisión de cita por WhatsApp/admin:', err)
  }

  const pendientesRestantes = contexto.admin_cita_ids.filter((id) => id !== cita.id)
  if (pendientesRestantes.length > 0) {
    await guardarContextoWhatsapp(telefono, {
      pendiente: true,
      ultima_accion: 'admin_aprobar_citas',
      admin_cita_ids: pendientesRestantes,
    })
  } else {
    await limpiarContextoWhatsapp(telefono)
  }

  const estadoTexto = aprobar ? 'aprobada' : 'rechazada'
  return `Cita ${estadoTexto} correctamente:\n\n🗓️ ${formatearFecha(cita.fecha_hora)}\n🧑 ${cita.paciente_nombre}\n🦷 ${cita.tratamiento_nombre ?? 'atención odontológica'}\n👨‍⚕️ ${cita.odontologo_nombre}`
}

async function pacientesInactivos(): Promise<string> {
  const pacientes = await query<{
    nombre: string
    telefono: string | null
    ultima_visita: string | null
  }>(
    `SELECT u.nombre, u.telefono, MAX(c.fecha_hora) AS ultima_visita
     FROM pacientes p
     JOIN usuarios u ON p.usuario_id = u.id
     LEFT JOIN citas c ON c.paciente_id = p.id AND c.estado = 'completada'
     WHERE p.activo = true
     GROUP BY u.nombre, u.telefono
     HAVING MAX(c.fecha_hora) IS NULL OR MAX(c.fecha_hora) < NOW() - INTERVAL '12 months'
     ORDER BY MAX(c.fecha_hora) ASC NULLS FIRST, u.nombre ASC
     LIMIT 10`
  )

  if (pacientes.length === 0) return 'No encontré pacientes inactivos por más de 12 meses.'

  const resumen = pacientes
    .map((p, i) => {
      const ultima = p.ultima_visita ? formatearFecha(p.ultima_visita) : 'sin visitas completadas'
      return `${i + 1}. ${p.nombre} · ${ultima}${p.telefono ? ` · ${p.telefono}` : ''}`
    })
    .join('\n')

  return `Pacientes sin asistir en 12 meses:\n\n${resumen}`
}

export async function procesarMensajeAdminWhatsapp(
  usuario: UsuarioAdminWhatsapp,
  texto: string,
  telefono: string
): Promise<ResultadoAdminWhatsapp> {
  const t = normalizarTexto(texto)
  const soloAdmin = (mensaje: () => Promise<string>): Promise<ResultadoAdminWhatsapp> =>
    usuario.rol !== 'admin'
      ? Promise.resolve({ atendido: true, mensaje: 'Esta consulta solo está disponible para administración.' })
      : mensaje().then((m) => ({ atendido: true, mensaje: m }))

  if (usuario.rol === 'admin') {
    const decision = await responderDecisionCitaAdmin(telefono, texto)
    if (decision) return { atendido: true, mensaje: decision }
  }

  if (/(ayuda|menu|opciones|comandos|que puedes|que haces|hola|buenas)/.test(t)) {
    return { atendido: true, mensaje: ayuda(usuario) }
  }

  // Búsqueda de paciente (antes que otros para no chocar con palabras genéricas)
  if (/(buscar|busca|datos de|informacion de|información de).*(paciente|cliente|cedula|cédula)/.test(t) ||
      /(paciente|cliente)\s+\w+/.test(t) && /(buscar|busca|datos|informacion|información)/.test(t)) {
    return { atendido: true, mensaje: await buscarPaciente(texto) }
  }

  if (/(pendiente|aprobacion|aprobar|confirmar solicitudes|solicitudes)/.test(t)) {
    return usuario.rol !== 'admin'
      ? { atendido: true, mensaje: 'Esta consulta solo está disponible para administración.' }
      : { atendido: true, mensaje: await pendientesAprobacion(telefono) }
  }

  if (/(sin asistir|inactivo|inactivos|12 meses|doce meses|no han asistido|no asisten)/.test(t)) {
    return soloAdmin(pacientesInactivos)
  }

  if (/(stock bajo|stock minimo|stock mínimo|insumo|inventario|agotad|por agotar|reabastec)/.test(t)) {
    return soloAdmin(insumosStockBajo)
  }

  if (/(tratamiento|servicio).*(frecuent|mas|más|popular|comun|común|top)/.test(t) ||
      /(frecuent|popular|top).*(tratamiento|servicio)/.test(t)) {
    return soloAdmin(tratamientosFrecuentes)
  }

  if (/(estado|estados|resumen).*(semana|semanal)/.test(t) && /(cita|citas)/.test(t)) {
    return soloAdmin(citasPorEstadoSemana)
  }

  if (/(ocupacion|ocupación|carga|agenda).*(odontologo|odontólogo|doctor|doctores)/.test(t) ||
      /(odontologo|odontólogo|doctor|doctores).*(ocupacion|ocupación|carga)/.test(t)) {
    return soloAdmin(ocupacionPorOdontologo)
  }

  if (/(cancelad|reprogramad).*(semana|semanal)/.test(t) ||
      /(semana|semanal).*(cancelad|reprogramad)/.test(t)) {
    return soloAdmin(citasCanceladasSemana)
  }

  if (/(cumple|cumpleanos|cumpleaños|aniversario)/.test(t)) {
    return soloAdmin(cumpleanosProximos)
  }

  if (/(cartera|facturas pendientes|por cobrar|pendientes de pago|deudas|mora)/.test(t)) {
    return soloAdmin(facturasPendientes)
  }

  if (/(ingreso|venta|facturacion|facturación|recaud).*(dia|día|hoy)/.test(t) ||
      /(hoy|dia|día).*(ingreso|venta|recaud)/.test(t)) {
    return soloAdmin(ingresosDelDia)
  }

  if (/(ingreso|venta|facturacion|facturación|recaud)/.test(t)) {
    return soloAdmin(ingresosDelMes)
  }

  if (/(total de pacientes|cuantos pacientes|cuántos pacientes|numero de pacientes|número de pacientes|pacientes activos|pacientes nuevos)/.test(t)) {
    return soloAdmin(totalPacientes)
  }

  if (/(proxima cita|próxima cita|siguiente cita|mi cita)/.test(t)) {
    return { atendido: true, mensaje: await proximaCita(usuario) }
  }

  if (/(hoy)/.test(t) && /(cita|agenda)/.test(t)) {
    return { atendido: true, mensaje: await citasDeHoy(usuario) }
  }

  if (/(manana|mañana|resumen|agenda|citas.*manana|cuantas citas|cuantas tengo|cuántas citas)/.test(t)) {
    return { atendido: true, mensaje: await resumenManiana(usuario) }
  }

  return { atendido: false }
}
