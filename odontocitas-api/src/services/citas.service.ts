import { query, queryOne } from '../db/pool'
import { registrarAuditoria } from './auditoria'
import { registrarEventoWhatsapp } from './whatsapp-eventos.service'
import { notificarReprogramacionCitaAAdmins, notificarSolicitudCitaAAdmins } from './notificaciones'
import { enviarMensajeWhatsApp } from './whatsapp.service'
import { guardarContextoWhatsapp, limpiarContextoWhatsapp } from './whatsapp-conversation.service'

export interface PacienteWA {
  paciente_id: string
  usuario_id: string
  nombre: string
  cedula: string
  telefono: string
}

export interface ResultadoCita {
  ok: boolean
  mensaje: string
}

export const HORARIOS_DISPONIBLES = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
]

const ZONA_HORARIA = 'America/Bogota'

function normalizarTelefono(telefono: string): string {
  let limpio = String(telefono).replace(/\D/g, '')
  if (limpio.length > 10 && limpio.startsWith('57')) limpio = limpio.slice(2)
  return limpio
}

function formatearFecha(fecha: string | Date): string {
  // Las citas se almacenan como hora de pared en UTC (misma convención que la
  // app web), por eso se formatean en UTC para mostrar la hora real agendada.
  return new Date(fecha).toLocaleString('es-CO', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'UTC',
  })
}

function extraerFechaHoraLocal(valor: string): { fecha: string; hora: string } | null {
  const match = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/)
  if (!match || !match[4] || !match[5]) return null
  return {
    fecha: `${match[1]}-${match[2]}-${match[3]}`,
    hora: `${match[4]}:${match[5]}`,
  }
}

function fechaHoraColombiaAUtcIso(fecha: string, hora: string): string {
  // Guardamos la hora de pared directamente en UTC (sin sumar offset) para
  // mantener la misma convención que usa el resto de la aplicación: la hora
  // local agendada se almacena tal cual y se muestra con timeZone UTC.
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const [horas, minutos] = hora.split(':').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia, horas, minutos)).toISOString()
}

// Como las citas se guardan en hora de pared sobre UTC, para comparar contra
// "ahora" usamos la hora local de Colombia (UTC-5) representada como instante
// UTC, evitando un desfase de 5 horas al validar fechas pasadas.
function ahoraColombiaComoUtc(): Date {
  return new Date(Date.now() - 5 * 60 * 60 * 1000)
}

function diaSemanaColombia(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia, 17))
  return fechaUtc.getUTCDay()
}

function validarFechaHoraCita(fechaHora?: string): { ok: true; fechaHoraIso: string; fecha: string; hora: string } | { ok: false; mensaje: string } {
  if (!fechaHora) {
    return { ok: false, mensaje: 'Para agendar tu cita dime la fecha y hora deseada (ej. 2026-06-20 09:00).' }
  }

  const local = extraerFechaHoraLocal(fechaHora)
  if (!local) {
    return { ok: false, mensaje: 'No entendí bien la fecha y hora. Escríbela como 2026-06-20 09:00.' }
  }

  if (!HORARIOS_DISPONIBLES.includes(local.hora)) {
    return { ok: false, mensaje: `Ese horario no está disponible. Puedes elegir: ${HORARIOS_DISPONIBLES.join(', ')}.` }
  }

  const diaSemana = diaSemanaColombia(local.fecha)
  if (diaSemana === 0) {
    return { ok: false, mensaje: 'Los domingos no tenemos agenda disponible. Elige un día de lunes a sábado.' }
  }
  if (diaSemana === 6 && local.hora >= '13:00') {
    return { ok: false, mensaje: 'Los sábados atendemos solo en la mañana. Elige un horario entre 08:00 y 11:30.' }
  }

  const fechaHoraIso = fechaHoraColombiaAUtcIso(local.fecha, local.hora)
  if (new Date(fechaHoraIso) <= ahoraColombiaComoUtc()) {
    return { ok: false, mensaje: 'No puedo agendar citas en fechas u horas pasadas. Elige un horario futuro.' }
  }

  return { ok: true, fechaHoraIso, fecha: local.fecha, hora: local.hora }
}

function normalizarFechaConsulta(fecha: string): string | null {
  const match = fecha.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

function fechaLocalColombia(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha)
}

function sumarMeses(fecha: Date, meses: number): Date {
  const nueva = new Date(fecha)
  nueva.setMonth(nueva.getMonth() + meses)
  return nueva
}

function mesesControlRecomendado(tratamiento?: string | null): number {
  const t = (tratamiento ?? '').toLowerCase()
  if (/(ortodoncia|bracket|brackets)/.test(t)) return 1
  if (/(endodoncia|conducto)/.test(t)) return 1
  if (/(cirug|extracci|cordal|muela)/.test(t)) return 1
  if (/(limpieza|profilaxis|control|revision|revisión|general)/.test(t)) return 6
  if (/(blanqueamiento|blanquear)/.test(t)) return 6
  if (/(pediatr|infantil|niñ)/.test(t)) return 6
  return 6
}

export async function buscarPacientePorTelefono(telefono: string): Promise<PacienteWA | null> {
  const tel = normalizarTelefono(telefono)
  return queryOne<PacienteWA>(
    `SELECT p.id AS paciente_id, u.id AS usuario_id, u.nombre, u.cedula, u.telefono
     FROM pacientes p
     JOIN usuarios u ON p.usuario_id = u.id
     WHERE p.activo = true
     AND regexp_replace(u.telefono, '\\D', '', 'g') IN ($1, '57' || $1)
     LIMIT 1`,
    [tel]
  )
}

async function resolverOdontologo(especialidad?: string) {
  const espNormalizada = especialidad?.trim().toLowerCase()
  if (espNormalizada) {
    const esp = await queryOne<{ id: string; nombre: string }>(
      `SELECT od.id, u.nombre
       FROM odontologos od
       JOIN usuarios u ON od.usuario_id = u.id
       WHERE u.activo = true AND od.especialidad::text = $1
       ORDER BY u.nombre ASC LIMIT 1`,
      [espNormalizada]
    )
    if (esp) return esp
  }

  return queryOne<{ id: string; nombre: string }>(
    `SELECT od.id, u.nombre
     FROM odontologos od
     JOIN usuarios u ON od.usuario_id = u.id
     WHERE u.activo = true
     ORDER BY u.nombre ASC LIMIT 1`
  )
}

async function resolverTratamiento(nombre?: string) {
  if (nombre) {
    const t = await queryOne<{ id: string; nombre: string; duracion_minutos: number }>(
      `SELECT id, nombre, duracion_minutos FROM tratamientos
       WHERE activo = true AND nombre ILIKE '%' || $1 || '%'
       ORDER BY tarifa ASC LIMIT 1`,
      [nombre]
    )
    if (t) return t
  }

  return queryOne<{ id: string; nombre: string; duracion_minutos: number }>(
    `SELECT id, nombre, duracion_minutos FROM tratamientos
     WHERE activo = true ORDER BY tarifa ASC LIMIT 1`
  )
}

async function hayConflicto(odontologoId: string, fechaHora: string, duracion: number, excluirCitaId?: string) {
  const params: unknown[] = [odontologoId, fechaHora, duracion]
  let sql = `
    SELECT id FROM citas
    WHERE odontologo_id = $1
    AND estado NOT IN ('cancelada', 'reprogramada')
    AND fecha_hora < ($2::timestamptz + ($3 || ' minutes')::interval)
    AND (fecha_hora + (duracion_minutos || ' minutes')::interval) > $2::timestamptz
  `
  if (excluirCitaId) {
    params.push(excluirCitaId)
    sql += ` AND id <> $${params.length}`
  }
  return queryOne<{ id: string }>(sql, params)
}

async function proximaCitaActiva(pacienteId: string) {
  return queryOne<{
    id: string
    fecha_hora: string
    estado: string
    duracion_minutos: number
    odontologo_id: string
    odontologo_nombre: string
    tratamiento_nombre: string | null
  }>(
    `SELECT c.id, c.fecha_hora, c.estado, c.duracion_minutos, c.odontologo_id,
            uo.nombre AS odontologo_nombre, t.nombre AS tratamiento_nombre
     FROM citas c
     JOIN odontologos od ON c.odontologo_id = od.id
     JOIN usuarios uo ON od.usuario_id = uo.id
     LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
     WHERE c.paciente_id = $1
     AND c.estado NOT IN ('cancelada', 'completada')
     AND c.fecha_hora >= NOW()
     ORDER BY c.fecha_hora ASC LIMIT 1`,
    [pacienteId]
  )
}

export async function crearCitaPaciente(
  paciente: PacienteWA,
  datos: { fecha_hora?: string; especialidad?: string; tratamiento?: string; motivo?: string }
): Promise<ResultadoCita> {
  const validacion = validarFechaHoraCita(datos.fecha_hora)
  if (!validacion.ok) return { ok: false, mensaje: validacion.mensaje }

  const odontologo = await resolverOdontologo(datos.especialidad)
  if (!odontologo) return { ok: false, mensaje: 'Por ahora no hay odontólogos disponibles para agendar. Intenta más tarde.' }

  const tratamiento = await resolverTratamiento(datos.tratamiento)
  if (!tratamiento) return { ok: false, mensaje: 'No encontré un tratamiento disponible para agendar. Comunícate con la clínica.' }

  const duracion = tratamiento.duracion_minutos ?? 45
  const conflicto = await hayConflicto(odontologo.id, validacion.fechaHoraIso, duracion)
  if (conflicto) {
    return { ok: false, mensaje: `El horario solicitado no está disponible con ${odontologo.nombre}. ¿Quieres probar otra hora?` }
  }

  const nuevaCita = await queryOne<{ id: string }>(
    `INSERT INTO citas (paciente_id, odontologo_id, tratamiento_id, fecha_hora, motivo, duracion_minutos, estado)
     VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
     RETURNING id`,
    [paciente.paciente_id, odontologo.id, tratamiento.id, validacion.fechaHoraIso, datos.motivo ?? 'Solicitud por WhatsApp', duracion]
  )
  if (!nuevaCita) return { ok: false, mensaje: 'No pude registrar la cita en este momento. Intenta de nuevo.' }

  try { await notificarSolicitudCitaAAdmins(nuevaCita.id) } catch (e) { console.error(e) }
  await registrarAuditoria({
    usuarioId: paciente.usuario_id,
    modulo: 'citas',
    accion: 'crear_cita_whatsapp',
    entidad: 'citas',
    entidadId: nuevaCita.id,
    detalle: { canal: 'whatsapp', tratamiento: tratamiento.nombre, odontologo: odontologo.nombre },
  })
  await registrarEventoWhatsapp({
    telefono: paciente.telefono ?? '',
    rol: 'paciente',
    tipo: 'cita_creada',
    detalle: { cita_id: nuevaCita.id, tratamiento: tratamiento.nombre },
  })

  return {
    ok: true,
    mensaje: `¡Listo, ${paciente.nombre.split(' ')[0]}! Tu solicitud de cita para ${tratamiento.nombre} con ${odontologo.nombre} el ${formatearFecha(validacion.fechaHoraIso)} quedó registrada y está pendiente de confirmación.`,
  }
}

export async function cancelarProximaCitaPaciente(paciente: PacienteWA): Promise<ResultadoCita> {
  const cita = await proximaCitaActiva(paciente.paciente_id)
  if (!cita) return { ok: false, mensaje: 'No encontré ninguna cita activa para cancelar.' }

  await query(
    `UPDATE citas SET estado = 'cancelada', motivo_cancelacion = 'Cancelada por el paciente vía WhatsApp', updated_at = NOW()
     WHERE id = $1`,
    [cita.id]
  )
  await registrarAuditoria({
    usuarioId: paciente.usuario_id,
    modulo: 'citas',
    accion: 'cancelar_cita_whatsapp',
    entidad: 'citas',
    entidadId: cita.id,
    detalle: { canal: 'whatsapp' },
  })
  await registrarEventoWhatsapp({
    telefono: paciente.telefono ?? '',
    rol: 'paciente',
    tipo: 'cita_cancelada',
    detalle: { cita_id: cita.id },
  })
  try { await ofrecerEspacioListaEspera(cita.id) } catch (e) { console.error('[lista-espera] No se pudo ofrecer espacio:', e) }

  return {
    ok: true,
    mensaje: `Tu cita del ${formatearFecha(cita.fecha_hora)} con ${cita.odontologo_nombre} fue cancelada. Si deseas, puedes agendar una nueva.`,
  }
}

export async function reprogramarProximaCitaPaciente(
  paciente: PacienteWA,
  datos: { fecha_hora?: string }
): Promise<ResultadoCita> {
  const validacion = validarFechaHoraCita(datos.fecha_hora)
  if (!validacion.ok) return { ok: false, mensaje: validacion.mensaje }

  const cita = await proximaCitaActiva(paciente.paciente_id)
  if (!cita) return { ok: false, mensaje: 'No encontré una cita activa para reprogramar.' }

  const duracion = cita.duracion_minutos ?? 45
  const conflicto = await hayConflicto(cita.odontologo_id, validacion.fechaHoraIso, duracion, cita.id)
  if (conflicto) {
    return { ok: false, mensaje: `El nuevo horario no está disponible con ${cita.odontologo_nombre}. ¿Quieres intentar con otra hora?` }
  }

  await query(
    `UPDATE citas SET fecha_hora = $2, estado = 'reprogramada', updated_at = NOW() WHERE id = $1`,
    [cita.id, validacion.fechaHoraIso]
  )
  try { await notificarReprogramacionCitaAAdmins(cita.id) } catch (e) { console.error(e) }
  await registrarAuditoria({
    usuarioId: paciente.usuario_id,
    modulo: 'citas',
    accion: 'reprogramar_cita_whatsapp',
    entidad: 'citas',
    entidadId: cita.id,
    detalle: { canal: 'whatsapp', nueva_fecha: validacion.fechaHoraIso },
  })

  return {
    ok: true,
    mensaje: `Tu cita se reprogramó para el ${formatearFecha(validacion.fechaHoraIso)} con ${cita.odontologo_nombre}. Queda pendiente de confirmación por la clínica.`,
  }
}

export async function consultarProximaCitaPaciente(paciente: PacienteWA): Promise<ResultadoCita> {
  const cita = await proximaCitaActiva(paciente.paciente_id)
  if (!cita) return { ok: true, mensaje: 'No tienes citas próximas agendadas. ¿Deseas agendar una?' }

  const estado =
    cita.estado === 'pendiente'
      ? 'pendiente de confirmación'
      : cita.estado === 'reprogramada'
        ? 'reprogramada, pendiente de confirmación'
        : cita.estado
  return {
    ok: true,
    mensaje: `Tu próxima cita es para ${cita.tratamiento_nombre ?? 'atención odontológica'} con ${cita.odontologo_nombre} el ${formatearFecha(cita.fecha_hora)} (${estado}).`,
  }
}

export interface CitaRecordatorio {
  id: string
  fecha_hora: string
  paciente_nombre: string
  paciente_telefono: string | null
  odontologo_nombre: string
  tratamiento_nombre: string | null
}

// Devuelve las citas activas programadas para mañana en hora Colombia,
// con el teléfono del paciente, para enviar recordatorios.
export async function citasDeManiana(): Promise<CitaRecordatorio[]> {
  return query<CitaRecordatorio>(
    `SELECT c.id, c.fecha_hora,
            up.nombre AS paciente_nombre, up.telefono AS paciente_telefono,
            uo.nombre AS odontologo_nombre, t.nombre AS tratamiento_nombre
     FROM citas c
     JOIN pacientes pac ON c.paciente_id = pac.id
     JOIN usuarios up ON pac.usuario_id = up.id
     JOIN odontologos od ON c.odontologo_id = od.id
     JOIN usuarios uo ON od.usuario_id = uo.id
     LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
     WHERE DATE(c.fecha_hora) =
           (DATE(NOW() AT TIME ZONE 'America/Bogota') + INTERVAL '1 day')
     AND c.estado IN ('pendiente', 'confirmada', 'reprogramada')
     ORDER BY c.fecha_hora ASC`
  )
}

export async function consultarDisponibilidadOdontologo(fecha: string, especialidad?: string): Promise<ResultadoCita> {
  const fechaConsulta = normalizarFechaConsulta(fecha)
  if (!fechaConsulta) return { ok: false, mensaje: 'Dime la fecha que quieres consultar (ej. 2026-06-20).' }

  const odontologo = await resolverOdontologo(especialidad)
  if (!odontologo) return { ok: false, mensaje: 'No hay odontólogos disponibles para consultar agenda.' }

  const diaSemana = diaSemanaColombia(fechaConsulta)
  if (diaSemana === 0) return { ok: true, mensaje: 'Los domingos no tenemos agenda disponible. ¿Quieres consultar otro día?' }

  const ocupados = await query<{ hora: string }>(
    `SELECT TO_CHAR(fecha_hora, 'HH24:MI') AS hora
     FROM citas
     WHERE odontologo_id = $1
     AND DATE(fecha_hora) = $2::date
     AND estado NOT IN ('cancelada', 'reprogramada')`,
    [odontologo.id, fechaConsulta]
  )
  const ocupadas = new Set(ocupados.map(o => o.hora))
  const horarios = diaSemana === 6 ? HORARIOS_DISPONIBLES.filter(h => h < '13:00') : HORARIOS_DISPONIBLES
  const libres = horarios.filter(h => !ocupadas.has(h))

  if (libres.length === 0) return { ok: true, mensaje: `No hay horarios libres con ${odontologo.nombre} para esa fecha. ¿Quieres probar otro día?` }
  return { ok: true, mensaje: `Horarios disponibles con ${odontologo.nombre}: ${libres.join(', ')}.` }
}

// Convierte un teléfono colombiano al formato que espera WhatsApp Cloud API
// (código de país sin "+"). Devuelve null si no hay número utilizable.
export function formatearTelefonoWhatsapp(telefono?: string | null): string | null {
  const limpio = String(telefono ?? '').replace(/\D/g, '')
  if (!limpio) return null
  if (limpio.startsWith('57')) return limpio
  if (limpio.length === 10) return `57${limpio}`
  return limpio
}

// Datos mínimos de una cita para validar acciones de confirmación/cancelación.
async function citaActivaPorId(citaId: string, pacienteId: string) {
  return queryOne<{
    id: string
    fecha_hora: string
    estado: string
    odontologo_nombre: string
    tratamiento_nombre: string | null
  }>(
    `SELECT c.id, c.fecha_hora, c.estado,
            uo.nombre AS odontologo_nombre, t.nombre AS tratamiento_nombre
     FROM citas c
     JOIN odontologos od ON c.odontologo_id = od.id
     JOIN usuarios uo ON od.usuario_id = uo.id
     LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
     WHERE c.id = $1 AND c.paciente_id = $2`,
    [citaId, pacienteId]
  )
}

// Confirma la asistencia a una cita concreta (la del recordatorio).
export async function confirmarAsistenciaCita(paciente: PacienteWA, citaId: string): Promise<ResultadoCita> {
  const cita = await citaActivaPorId(citaId, paciente.paciente_id)
  if (!cita) return { ok: false, mensaje: 'No encontré esa cita. Escríbeme "mi cita" para revisar tus citas activas.' }
  if (['cancelada', 'completada'].includes(cita.estado)) {
    return { ok: false, mensaje: `Esa cita ya está ${cita.estado} y no se puede confirmar.` }
  }

  await query(
    `UPDATE citas SET estado = 'confirmada', confirmado_en = NOW(), updated_at = NOW() WHERE id = $1`,
    [cita.id]
  )
  await registrarAuditoria({
    usuarioId: paciente.usuario_id,
    modulo: 'citas',
    accion: 'confirmar_asistencia_whatsapp',
    entidad: 'citas',
    entidadId: cita.id,
    detalle: { canal: 'whatsapp' },
  })

  return {
    ok: true,
    mensaje: `✅ ¡Gracias, ${paciente.nombre.split(' ')[0]}! Confirmamos tu asistencia a la cita del ${formatearFecha(cita.fecha_hora)} con ${cita.odontologo_nombre}. ¡Te esperamos!`,
  }
}

// Cancela una cita concreta (la del recordatorio) y libera el espacio.
export async function cancelarCitaPorId(paciente: PacienteWA, citaId: string): Promise<ResultadoCita> {
  const cita = await citaActivaPorId(citaId, paciente.paciente_id)
  if (!cita) return { ok: false, mensaje: 'No encontré esa cita para cancelar.' }
  if (['cancelada', 'completada'].includes(cita.estado)) {
    return { ok: false, mensaje: `Esa cita ya está ${cita.estado}.` }
  }

  await query(
    `UPDATE citas SET estado = 'cancelada', motivo_cancelacion = 'Cancelada por el paciente vía WhatsApp', updated_at = NOW()
     WHERE id = $1`,
    [cita.id]
  )
  await registrarAuditoria({
    usuarioId: paciente.usuario_id,
    modulo: 'citas',
    accion: 'cancelar_cita_whatsapp',
    entidad: 'citas',
    entidadId: cita.id,
    detalle: { canal: 'whatsapp', origen: 'recordatorio' },
  })
  await registrarEventoWhatsapp({
    telefono: paciente.telefono ?? '',
    rol: 'paciente',
    tipo: 'cita_cancelada',
    detalle: { cita_id: cita.id, origen: 'recordatorio' },
  })
  try { await ofrecerEspacioListaEspera(cita.id) } catch (e) { console.error('[lista-espera] No se pudo ofrecer espacio:', e) }

  return {
    ok: true,
    mensaje: `Tu cita del ${formatearFecha(cita.fecha_hora)} con ${cita.odontologo_nombre} fue cancelada. Si deseas, puedes agendar una nueva cuando quieras.`,
  }
}

type CitaCanceladaParaOferta = {
  id: string
  fecha_hora: string
  duracion_minutos: number
  paciente_id: string
  odontologo_id: string
  tratamiento_id: string | null
  odontologo_nombre: string
  tratamiento_nombre: string | null
}

type CandidatoListaEspera = {
  cita_id: string
  paciente_id: string
  usuario_id: string
  paciente_nombre: string
  paciente_telefono: string | null
  fecha_hora_actual: string
}

async function obtenerCitaCancelada(citaId: string): Promise<CitaCanceladaParaOferta | null> {
  return queryOne<CitaCanceladaParaOferta>(
    `SELECT c.id, c.fecha_hora, c.duracion_minutos, c.paciente_id, c.odontologo_id, c.tratamiento_id,
            uo.nombre AS odontologo_nombre, t.nombre AS tratamiento_nombre
     FROM citas c
     JOIN odontologos od ON c.odontologo_id = od.id
     JOIN usuarios uo ON od.usuario_id = uo.id
     LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
     WHERE c.id = $1 AND c.estado = 'cancelada'`,
    [citaId]
  )
}

async function candidatosListaEspera(cita: CitaCanceladaParaOferta): Promise<CandidatoListaEspera[]> {
  const params: unknown[] = [cita.id, cita.paciente_id, cita.fecha_hora]
  let filtroTratamiento = ''
  if (cita.tratamiento_id) {
    params.push(cita.tratamiento_id)
    filtroTratamiento = `AND c.tratamiento_id = $${params.length}`
  }

  return query<CandidatoListaEspera>(
    `SELECT c.id AS cita_id, c.paciente_id, up.id AS usuario_id,
            up.nombre AS paciente_nombre, up.telefono AS paciente_telefono,
            c.fecha_hora AS fecha_hora_actual
     FROM citas c
     JOIN pacientes pac ON c.paciente_id = pac.id
     JOIN usuarios up ON pac.usuario_id = up.id
     WHERE c.id <> $1
     AND c.paciente_id <> $2
     AND c.estado IN ('pendiente', 'confirmada', 'reprogramada')
     AND c.fecha_hora > $3::timestamptz
     ${filtroTratamiento}
     AND up.telefono IS NOT NULL
     ORDER BY c.fecha_hora ASC
     LIMIT 3`,
    params
  )
}

export async function ofrecerEspacioListaEspera(citaCanceladaId: string): Promise<number> {
  const cita = await obtenerCitaCancelada(citaCanceladaId)
  if (!cita) return 0
  if (new Date(cita.fecha_hora) <= ahoraColombiaComoUtc()) return 0

  const conflicto = await hayConflicto(cita.odontologo_id, cita.fecha_hora, cita.duracion_minutos, cita.id)
  if (conflicto) return 0

  const candidatos = await candidatosListaEspera(cita)
  let enviados = 0
  for (const candidato of candidatos) {
    const numero = formatearTelefonoWhatsapp(candidato.paciente_telefono)
    if (!numero) continue

    const primerNombre = candidato.paciente_nombre.split(' ')[0]
    const tratamiento = cita.tratamiento_nombre ?? 'atención odontológica'
    const mensaje =
      `Hola ${primerNombre} 👋\n\n` +
      `Se liberó un espacio para ${tratamiento} con ${cita.odontologo_nombre} ` +
      `el ${formatearFecha(cita.fecha_hora)}.\n\n` +
      `Tu cita actual está para el ${formatearFecha(candidato.fecha_hora_actual)}.\n\n` +
      `¿Quieres adelantarla a este nuevo horario?\n` +
      `1️⃣ Sí, tomar el espacio\n` +
      `2️⃣ No, mantener mi cita`

    await enviarMensajeWhatsApp(numero, mensaje)
    await guardarContextoWhatsapp(numero, {
      pendiente: true,
      ultima_accion: 'oferta_lista_espera',
      cita_id: candidato.cita_id,
      slot_cita_id: cita.id,
    })
    enviados += 1
  }
  return enviados
}

export async function tomarEspacioListaEspera(paciente: PacienteWA, citaId: string, slotCitaId: string): Promise<ResultadoCita> {
  const citaPaciente = await citaActivaPorId(citaId, paciente.paciente_id)
  if (!citaPaciente) return { ok: false, mensaje: 'No encontré tu cita para adelantarla.' }
  if (['cancelada', 'completada'].includes(citaPaciente.estado)) {
    return { ok: false, mensaje: `Tu cita ya está ${citaPaciente.estado} y no se puede adelantar.` }
  }

  const slot = await obtenerCitaCancelada(slotCitaId)
  if (!slot) return { ok: false, mensaje: 'Ese espacio ya no está disponible.' }
  if (new Date(slot.fecha_hora) <= ahoraColombiaComoUtc()) return { ok: false, mensaje: 'Ese espacio ya pasó y no está disponible.' }

  const conflicto = await hayConflicto(slot.odontologo_id, slot.fecha_hora, slot.duracion_minutos, slot.id)
  if (conflicto) return { ok: false, mensaje: 'Ese espacio ya fue tomado por otro paciente.' }

  await query(
    `UPDATE citas
     SET fecha_hora = $2, odontologo_id = $3, estado = 'reprogramada', updated_at = NOW()
     WHERE id = $1`,
    [citaPaciente.id, slot.fecha_hora, slot.odontologo_id]
  )
  try { await notificarReprogramacionCitaAAdmins(citaPaciente.id) } catch (e) { console.error(e) }
  await registrarAuditoria({
    usuarioId: paciente.usuario_id,
    modulo: 'citas',
    accion: 'tomar_espacio_lista_espera_whatsapp',
    entidad: 'citas',
    entidadId: citaPaciente.id,
    detalle: { canal: 'whatsapp', slot_cita_id: slot.id, nueva_fecha: slot.fecha_hora },
  })

  return {
    ok: true,
    mensaje: `¡Listo, ${paciente.nombre.split(' ')[0]}! Movimos tu cita al ${formatearFecha(slot.fecha_hora)} con ${slot.odontologo_nombre}. Queda pendiente de confirmación por la clínica.`,
  }
}

export async function rechazarEspacioListaEspera(telefono: string): Promise<ResultadoCita> {
  await limpiarContextoWhatsapp(telefono)
  return { ok: true, mensaje: 'Perfecto, mantendremos tu cita como estaba. Gracias por responder.' }
}

export async function recomendarControlPostCitaWhatsapp(citaId: string): Promise<void> {
  const cita = await queryOne<{
    fecha_hora: string
    paciente_nombre: string
    paciente_telefono: string | null
    tratamiento_nombre: string | null
  }>(
    `SELECT c.fecha_hora,
            up.nombre AS paciente_nombre, up.telefono AS paciente_telefono,
            t.nombre AS tratamiento_nombre
     FROM citas c
     JOIN pacientes pac ON c.paciente_id = pac.id
     JOIN usuarios up ON pac.usuario_id = up.id
     LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
     WHERE c.id = $1 AND c.estado = 'completada'`,
    [citaId]
  )
  if (!cita) return

  const numero = formatearTelefonoWhatsapp(cita.paciente_telefono)
  if (!numero) return

  const meses = mesesControlRecomendado(cita.tratamiento_nombre)
  const fechaSugerida = fechaLocalColombia(sumarMeses(new Date(cita.fecha_hora), meses))
  const primerNombre = cita.paciente_nombre.split(' ')[0]
  const tratamiento = cita.tratamiento_nombre ?? 'tu tratamiento'
  const mensaje =
    `Hola ${primerNombre} 👋\n\n` +
    `Tu cita de ${tratamiento} fue marcada como completada. ` +
    `Como seguimiento, recomendamos un control en ${meses === 1 ? '1 mes' : `${meses} meses`} ` +
    `(aprox. ${fechaSugerida}).\n\n` +
    `¿Deseas programarlo ahora?\n` +
    `1️⃣ Sí, ver horarios\n` +
    `2️⃣ No por ahora`

  await enviarMensajeWhatsApp(numero, mensaje)
  await guardarContextoWhatsapp(numero, {
    pendiente: true,
    ultima_accion: 'recomendacion_control',
    datos: {
      accion: 'crear_cita',
      fecha: fechaSugerida,
      tratamiento: cita.tratamiento_nombre ?? null,
      motivo: `Control recomendado posterior a ${tratamiento}`,
    },
  })
}

// Envía al paciente, por WhatsApp, la confirmación de su cita cuando el
// administrador la acepta. No lanza si el número o las credenciales faltan.
export async function notificarConfirmacionCitaWhatsapp(citaId: string): Promise<void> {
  const cita = await queryOne<{
    fecha_hora: string
    paciente_nombre: string
    paciente_telefono: string | null
    odontologo_nombre: string
    tratamiento_nombre: string | null
  }>(
    `SELECT c.fecha_hora,
            up.nombre AS paciente_nombre, up.telefono AS paciente_telefono,
            uo.nombre AS odontologo_nombre, t.nombre AS tratamiento_nombre
     FROM citas c
     JOIN pacientes pac ON c.paciente_id = pac.id
     JOIN usuarios up ON pac.usuario_id = up.id
     JOIN odontologos od ON c.odontologo_id = od.id
     JOIN usuarios uo ON od.usuario_id = uo.id
     LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
     WHERE c.id = $1`,
    [citaId]
  )
  if (!cita) return

  const numero = formatearTelefonoWhatsapp(cita.paciente_telefono)
  if (!numero) return

  const primerNombre = cita.paciente_nombre.split(' ')[0]
  const tratamiento = cita.tratamiento_nombre ?? 'atención odontológica'
  const mensaje =
    `✅ ¡Hola ${primerNombre}! Tu cita para ${tratamiento} con ${cita.odontologo_nombre} ` +
    `fue confirmada para el ${formatearFecha(cita.fecha_hora)}. ¡Te esperamos! ` +
    `Si necesitas cancelar o reprogramar, escríbenos por este chat.`

  await enviarMensajeWhatsApp(numero, mensaje)
}
