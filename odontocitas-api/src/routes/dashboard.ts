import { Router } from 'express'
import { query, queryOne } from '../db/pool'
import { authenticate, authorize } from '../middleware/auth'
import { metricasWhatsappDashboard } from '../services/whatsapp-dashboard.service'
import type { Request, Response } from 'express'

const router = Router()
router.use(authenticate, authorize('admin'))

// GET /api/dashboard/metricas
router.get('/metricas', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [citas, pacientes, ingresos, pendientes] = await Promise.all([
      queryOne<{ count: string }>(`
        SELECT COUNT(*)::int AS count FROM citas
        WHERE DATE(fecha_hora) = CURRENT_DATE AND estado != 'cancelada'
      `),
      queryOne<{ count: string }>('SELECT COUNT(*)::int AS count FROM pacientes WHERE activo = true'),
      queryOne<{ total: string }>(`
        SELECT COALESCE(SUM(t.tarifa), 0) AS total
        FROM citas c
        JOIN tratamientos t ON c.tratamiento_id = t.id
        WHERE c.estado = 'completada'
        AND DATE_TRUNC('month', c.fecha_hora) = DATE_TRUNC('month', CURRENT_DATE)
      `),
      queryOne<{ count: string }>(`
        SELECT COUNT(*)::int AS count FROM citas
        WHERE estado IN ('pendiente', 'reprogramada') AND fecha_hora >= NOW()
      `),
    ])

    res.json({
      citas_hoy: citas?.count ?? 0,
      pacientes_activos: pacientes?.count ?? 0,
      ingresos_mes: Number(ingresos?.total ?? 0),
      pendientes_confirmar: pendientes?.count ?? 0,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener métricas' })
  }
})

// GET /api/dashboard/citas-hoy
router.get('/citas-hoy', async (_req: Request, res: Response): Promise<void> => {
  try {
    const citas = await query(`
      SELECT
        c.id, c.fecha_hora, c.estado,
        up.nombre AS paciente_nombre, up.cedula AS paciente_cedula,
        uo.nombre AS odontologo_nombre,
        t.nombre AS tratamiento_nombre
      FROM citas c
      JOIN pacientes p ON c.paciente_id = p.id
      JOIN usuarios up ON p.usuario_id = up.id
      JOIN odontologos od ON c.odontologo_id = od.id
      JOIN usuarios uo ON od.usuario_id = uo.id
      LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
      WHERE DATE(c.fecha_hora) = CURRENT_DATE
      AND c.estado != 'cancelada'
      ORDER BY c.fecha_hora ASC
      LIMIT 10
    `)
    res.json(citas)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener citas de hoy' })
  }
})

// GET /api/dashboard/tratamientos-mes
router.get('/tratamientos-mes', async (_req: Request, res: Response): Promise<void> => {
  try {
    const tratamientos = await query(`
      SELECT t.nombre, COUNT(*)::int AS cantidad
      FROM citas c
      JOIN tratamientos t ON c.tratamiento_id = t.id
      WHERE DATE_TRUNC('month', c.fecha_hora) = DATE_TRUNC('month', CURRENT_DATE)
      AND c.estado = 'completada'
      GROUP BY t.nombre
      ORDER BY cantidad DESC
      LIMIT 6
    `)
    res.json(tratamientos)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener tratamientos' })
  }
})

router.get('/ingresos-semanales', async (_req: Request, res: Response): Promise<void> => {
  try {
    const ingresos = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('week', c.fecha_hora), 'DD Mon') AS semana,
        COALESCE(SUM(t.tarifa), 0)::int AS ingresos
      FROM citas c
      JOIN tratamientos t ON c.tratamiento_id = t.id
      WHERE c.estado = 'completada'
      AND DATE_TRUNC('month', c.fecha_hora) = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY DATE_TRUNC('week', c.fecha_hora)
      ORDER BY DATE_TRUNC('week', c.fecha_hora)
    `)
    res.json(ingresos)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener ingresos semanales' })
  }
})

router.get('/citas-odontologo', async (_req: Request, res: Response): Promise<void> => {
  try {
    const citas = await query(`
      SELECT u.nombre, COUNT(*)::int AS citas
      FROM citas c
      JOIN odontologos od ON c.odontologo_id = od.id
      JOIN usuarios u ON od.usuario_id = u.id
      WHERE DATE_TRUNC('month', c.fecha_hora) = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY u.nombre
      ORDER BY COUNT(*) DESC
      LIMIT 6
    `)
    res.json(citas)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener citas por odontólogo' })
  }
})

// GET /api/dashboard/whatsapp — métricas del chatbot para el panel admin
router.get('/whatsapp', async (_req: Request, res: Response): Promise<void> => {
  try {
    const metricas = await metricasWhatsappDashboard()
    res.json(metricas)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener métricas de WhatsApp' })
  }
})

// ─── GET /api/dashboard/reportes?mes=YYYY-MM ───────────────────────
// Reporte consolidado del mes (por defecto el actual) con comparación
// contra el mes anterior. Todo se calcula en vivo desde la base de datos.
async function metricasPeriodo(ini: string, fin: string) {
  const row = await queryOne<{
    ingresos: string; realizadas: number; canceladas: number; nuevos: number
  }>(
    `SELECT
       (SELECT COALESCE(SUM(t.tarifa), 0) FROM citas c
          JOIN tratamientos t ON c.tratamiento_id = t.id
          WHERE c.estado = 'completada' AND c.fecha_hora >= $1 AND c.fecha_hora < $2) AS ingresos,
       (SELECT COUNT(*)::int FROM citas c
          WHERE c.estado = 'completada' AND c.fecha_hora >= $1 AND c.fecha_hora < $2) AS realizadas,
       (SELECT COUNT(*)::int FROM citas c
          WHERE c.estado = 'cancelada' AND c.fecha_hora >= $1 AND c.fecha_hora < $2) AS canceladas,
       (SELECT COUNT(*)::int FROM pacientes p
          WHERE p.created_at >= $1 AND p.created_at < $2) AS nuevos`,
    [ini, fin]
  )
  const ingresos = Number(row?.ingresos ?? 0)
  const realizadas = row?.realizadas ?? 0
  const canceladas = row?.canceladas ?? 0
  const nuevos = row?.nuevos ?? 0
  const concluidas = realizadas + canceladas
  const tasa_ausentismo = concluidas > 0 ? (canceladas / concluidas) * 100 : 0
  return { ingresos, citas_realizadas: realizadas, tasa_ausentismo, nuevos_pacientes: nuevos }
}

// --- Predicciones en tiempo real -------------------------------------------
// En lugar de proyectar por meses, estimamos a partir del ritmo diario de los
// últimos 30 días. Como el endpoint se recalcula en cada consulta, cada nueva
// cita completada, alta de paciente o cancelación mueve los números al instante.

function estadisticasSerie(valores: number[]) {
  const dias = valores.length || 1
  const total30 = valores.reduce((a, b) => a + b, 0)
  const ritmo_diario = total30 / dias
  const ultimos_7 = valores.slice(-7).reduce((a, b) => a + b, 0)
  const previos_7 = valores.slice(-14, -7).reduce((a, b) => a + b, 0)
  const tendencia_pct = previos_7 > 0
    ? ((ultimos_7 - previos_7) / previos_7) * 100
    : (ultimos_7 > 0 ? 100 : 0)
  return { total30, ritmo_diario, ultimos_7, previos_7, tendencia_pct }
}

function diasRestantesMes(): number {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
  const [y, m, d] = hoy.split('-').map(Number)
  const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Math.max(0, diasMes - d)
}

async function prediccionPacientes() {
  const serieRaw = await query<{ fecha: string; pacientes: number }>(`
    SELECT to_char(d.dia, 'YYYY-MM-DD') AS fecha, COALESCE(c.n, 0)::int AS pacientes
    FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') d(dia)
    LEFT JOIN (
      SELECT DATE(fecha_hora) AS dia, COUNT(*) AS n
      FROM citas
      WHERE estado = 'completada' AND fecha_hora >= CURRENT_DATE - INTERVAL '29 days'
      GROUP BY DATE(fecha_hora)
    ) c ON c.dia = d.dia::date
    ORDER BY d.dia
  `)
  const realizadoRow = await queryOne<{ n: number }>(`
    SELECT COUNT(*)::int AS n FROM citas
    WHERE estado = 'completada'
    AND DATE_TRUNC('month', fecha_hora) = DATE_TRUNC('month', CURRENT_DATE)
  `)

  const serie = serieRaw.map(p => ({ fecha: p.fecha, pacientes: Number(p.pacientes) }))
  const stats = estadisticasSerie(serie.map(p => p.pacientes))
  const realizado_mes_actual = realizadoRow?.n ?? 0
  const dias_restantes = diasRestantesMes()
  const proyeccion_mes_actual = realizado_mes_actual + Math.round(stats.ritmo_diario * dias_restantes)
  const sinDatos = stats.total30 === 0 && realizado_mes_actual === 0

  return {
    serie,
    ritmo_diario: Number(stats.ritmo_diario.toFixed(2)),
    ultimos_7: stats.ultimos_7,
    previos_7: stats.previos_7,
    tendencia_pct: Number(stats.tendencia_pct.toFixed(1)),
    proyeccion_7dias: Math.round(stats.ritmo_diario * 7),
    proyeccion_30dias: Math.round(stats.ritmo_diario * 30),
    realizado_mes_actual,
    proyeccion_mes_actual,
    metodo: sinDatos ? 'sin_datos' : 'tiempo_real',
    mensaje: sinDatos
      ? 'Aún no hay citas completadas para estimar. La proyección se actualizará en cuanto se registre actividad.'
      : 'Proyección en tiempo real según el ritmo diario de los últimos 30 días. Se actualiza con cada cita completada, alta o cancelación.',
  }
}

async function prediccionIngresos() {
  const serieRaw = await query<{ fecha: string; ingresos: number }>(`
    SELECT to_char(d.dia, 'YYYY-MM-DD') AS fecha, COALESCE(c.ingresos, 0)::float AS ingresos
    FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') d(dia)
    LEFT JOIN (
      SELECT DATE(c.fecha_hora) AS dia, SUM(t.tarifa) AS ingresos
      FROM citas c
      JOIN tratamientos t ON c.tratamiento_id = t.id
      WHERE c.estado = 'completada' AND c.fecha_hora >= CURRENT_DATE - INTERVAL '29 days'
      GROUP BY DATE(c.fecha_hora)
    ) c ON c.dia = d.dia::date
    ORDER BY d.dia
  `)
  const realizadoRow = await queryOne<{ ingresos: number }>(`
    SELECT COALESCE(SUM(t.tarifa), 0)::float AS ingresos
    FROM citas c
    JOIN tratamientos t ON c.tratamiento_id = t.id
    WHERE c.estado = 'completada'
    AND DATE_TRUNC('month', c.fecha_hora) = DATE_TRUNC('month', CURRENT_DATE)
  `)

  const serie = serieRaw.map(p => ({ fecha: p.fecha, ingresos: Number(p.ingresos) }))
  const stats = estadisticasSerie(serie.map(p => p.ingresos))
  const realizado_mes_actual = Math.round(realizadoRow?.ingresos ?? 0)
  const dias_restantes = diasRestantesMes()
  const proyeccion_mes_actual = realizado_mes_actual + Math.round(stats.ritmo_diario * dias_restantes)
  const sinDatos = stats.total30 === 0 && realizado_mes_actual === 0

  return {
    serie,
    ritmo_diario: Math.round(stats.ritmo_diario),
    ultimos_7: Math.round(stats.ultimos_7),
    previos_7: Math.round(stats.previos_7),
    tendencia_pct: Number(stats.tendencia_pct.toFixed(1)),
    proyeccion_7dias: Math.round(stats.ritmo_diario * 7),
    proyeccion_30dias: Math.round(stats.ritmo_diario * 30),
    realizado_mes_actual,
    proyeccion_mes_actual,
    metodo: sinDatos ? 'sin_datos' : 'tiempo_real',
    mensaje: sinDatos
      ? 'Aún no hay ingresos por citas completadas para estimar.'
      : 'Estimación de recaudo en tiempo real según el ritmo diario de los últimos 30 días.',
  }
}

async function prediccionEspecialidades() {
  const filas = await query<{ especialidad: string; ultimos30: number; previos30: number }>(`
    SELECT COALESCE(t.especialidad::text, 'general') AS especialidad,
           COUNT(*) FILTER (WHERE c.fecha_hora >= CURRENT_DATE - INTERVAL '30 days')::int AS ultimos30,
           COUNT(*) FILTER (
             WHERE c.fecha_hora >= CURRENT_DATE - INTERVAL '60 days'
               AND c.fecha_hora <  CURRENT_DATE - INTERVAL '30 days'
           )::int AS previos30
    FROM citas c
    JOIN tratamientos t ON c.tratamiento_id = t.id
    WHERE c.estado = 'completada' AND c.fecha_hora >= CURRENT_DATE - INTERVAL '60 days'
    GROUP BY t.especialidad
  `)

  const prediccion = filas.map(f => {
    const actual = Number(f.ultimos30)
    const previo = Number(f.previos30)
    const estimado = Math.max(0, actual + (actual - previo))
    const tendencia_pct = previo > 0
      ? ((actual - previo) / previo) * 100
      : (actual > 0 ? 100 : 0)
    return { especialidad: f.especialidad, actual, estimado, tendencia_pct, metodo: 'tiempo_real' }
  })

  return prediccion.sort((a, b) => Math.abs(b.tendencia_pct) - Math.abs(a.tendencia_pct))
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

async function riesgoInasistenciaProximasCitas() {
  const citas = await query<{
    id: string
    fecha_hora: string
    estado: string
    paciente_nombre: string
    odontologo_nombre: string
    tratamiento_nombre: string | null
    total_historico: number
    canceladas_historico: number
    completadas_historico: number
  }>(`
    SELECT
      c.id, c.fecha_hora, c.estado,
      up.nombre AS paciente_nombre,
      uo.nombre AS odontologo_nombre,
      t.nombre AS tratamiento_nombre,
      COUNT(hist.id)::int AS total_historico,
      COUNT(hist.id) FILTER (WHERE hist.estado = 'cancelada')::int AS canceladas_historico,
      COUNT(hist.id) FILTER (WHERE hist.estado = 'completada')::int AS completadas_historico
    FROM citas c
    JOIN pacientes pac ON c.paciente_id = pac.id
    JOIN usuarios up ON pac.usuario_id = up.id
    JOIN odontologos od ON c.odontologo_id = od.id
    JOIN usuarios uo ON od.usuario_id = uo.id
    LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
    LEFT JOIN citas hist ON hist.paciente_id = c.paciente_id AND hist.id <> c.id
    WHERE c.fecha_hora >= NOW()
      AND c.fecha_hora < NOW() + INTERVAL '30 days'
      AND c.estado IN ('pendiente', 'confirmada', 'reprogramada')
    GROUP BY c.id, up.nombre, uo.nombre, t.nombre
    ORDER BY c.fecha_hora ASC
    LIMIT 80
  `)

  return citas.map(cita => {
    const fecha = new Date(cita.fecha_hora)
    const horasHastaCita = (fecha.getTime() - Date.now()) / 36e5
    const horaLocal = Number(new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: '2-digit',
      hour12: false,
    }).format(fecha))
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
    }).format(fecha)
    const diaSemana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)

    const total = Number(cita.total_historico ?? 0)
    const canceladas = Number(cita.canceladas_historico ?? 0)
    const completadas = Number(cita.completadas_historico ?? 0)
    const tasaCancelacion = total > 0 ? canceladas / total : 0

    let score = 18
    score += tasaCancelacion * 45
    if (canceladas >= 2) score += 12
    if (completadas === 0 && total > 0) score += 8
    if (total === 0) score += 10
    if (cita.estado === 'pendiente') score += 16
    if (cita.estado === 'reprogramada') score += 10
    if (horasHastaCita < 24) score += 10
    if (horasHastaCita >= 24 && horasHastaCita < 48) score += 6
    if (horaLocal <= 8 || horaLocal >= 16) score += 5
    if (diaSemana === 1 || diaSemana === 6) score += 4

    const probabilidad = Math.round(clamp(score, 5, 95))
    const nivel = probabilidad >= 75 ? 'alto' : probabilidad >= 45 ? 'medio' : 'bajo'
    const factores = [
      tasaCancelacion >= 0.4 ? 'Historial alto de cancelaciones' : null,
      total === 0 ? 'Paciente sin historial previo' : null,
      cita.estado === 'pendiente' ? 'Cita pendiente de confirmación' : null,
      cita.estado === 'reprogramada' ? 'Cita reprogramada previamente' : null,
      horasHastaCita < 48 ? 'Cita muy próxima' : null,
      horaLocal <= 8 || horaLocal >= 16 ? 'Horario sensible' : null,
    ].filter(Boolean)

    return {
      id: cita.id,
      fecha_hora: cita.fecha_hora,
      paciente_nombre: cita.paciente_nombre,
      odontologo_nombre: cita.odontologo_nombre,
      tratamiento_nombre: cita.tratamiento_nombre,
      probabilidad,
      nivel,
      factores,
    }
  }).sort((a, b) => b.probabilidad - a.probabilidad).slice(0, 8)
}

router.get('/reportes', async (req: Request, res: Response): Promise<void> => {
  try {
    const mesParam = typeof req.query.mes === 'string' && /^\d{4}-\d{2}$/.test(req.query.mes)
      ? req.query.mes
      : null
    const base = mesParam ? new Date(`${mesParam}-01T00:00:00Z`) : new Date()
    const y = base.getUTCFullYear()
    const m = base.getUTCMonth()
    const ini = new Date(Date.UTC(y, m, 1)).toISOString()
    const fin = new Date(Date.UTC(y, m + 1, 1)).toISOString()
    const iniPrev = new Date(Date.UTC(y, m - 1, 1)).toISOString()

    const [
      actual,
      previo,
      ingresosSemanales,
      tratamientos,
      citasOdo,
      ausentismoDow,
      cartera,
      prediccion,
      prediccionIngresosData,
      prediccionEspecialidadesData,
      riesgoInasistencia,
    ] = await Promise.all([
      metricasPeriodo(ini, fin),
      metricasPeriodo(iniPrev, ini),
      query(`
        SELECT TO_CHAR(DATE_TRUNC('week', c.fecha_hora), 'DD Mon') AS semana,
               COALESCE(SUM(t.tarifa), 0)::int AS ingresos
        FROM citas c JOIN tratamientos t ON c.tratamiento_id = t.id
        WHERE c.estado = 'completada' AND c.fecha_hora >= $1 AND c.fecha_hora < $2
        GROUP BY DATE_TRUNC('week', c.fecha_hora)
        ORDER BY DATE_TRUNC('week', c.fecha_hora)
      `, [ini, fin]),
      query(`
        SELECT t.nombre, COUNT(*)::int AS cantidad
        FROM citas c JOIN tratamientos t ON c.tratamiento_id = t.id
        WHERE c.estado = 'completada' AND c.fecha_hora >= $1 AND c.fecha_hora < $2
        GROUP BY t.nombre ORDER BY cantidad DESC LIMIT 6
      `, [ini, fin]),
      query(`
        SELECT u.nombre, COUNT(*)::int AS citas
        FROM citas c
        JOIN odontologos od ON c.odontologo_id = od.id
        JOIN usuarios u ON od.usuario_id = u.id
        WHERE c.fecha_hora >= $1 AND c.fecha_hora < $2 AND c.estado != 'cancelada'
        GROUP BY u.nombre ORDER BY COUNT(*) DESC LIMIT 6
      `, [ini, fin]),
      query<{ dow: number; valor: number }>(`
        SELECT EXTRACT(DOW FROM fecha_hora)::int AS dow, COUNT(*)::int AS valor
        FROM citas
        WHERE estado = 'cancelada' AND fecha_hora >= $1 AND fecha_hora < $2
        GROUP BY dow
      `, [ini, fin]),
      queryOne<{ cobrado: number; pendiente: number; vencida: number }>(`
        SELECT
          COALESCE(SUM(total) FILTER (WHERE estado = 'pagada'), 0)::float AS cobrado,
          COALESCE(SUM(total) FILTER (WHERE estado = 'pendiente'), 0)::float AS pendiente,
          COALESCE(SUM(total) FILTER (WHERE estado = 'vencida'), 0)::float AS vencida
        FROM facturas
        WHERE fecha_emision >= $1 AND fecha_emision < $2
      `, [ini, fin]),
      prediccionPacientes(),
      prediccionIngresos(),
      prediccionEspecialidades(),
      riesgoInasistenciaProximasCitas(),
    ])

    const diasMap = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
    const dowValores: Record<number, number> = {}
    for (const r of ausentismoDow) dowValores[r.dow] = r.valor
    // Lunes(1) a Sábado(6)
    const ausentismo_por_dia = [1, 2, 3, 4, 5, 6].map(d => ({ dia: diasMap[d], valor: dowValores[d] ?? 0 }))

    res.json({
      periodo: { mes: mesParam ?? new Date().toISOString().slice(0, 7), inicio: ini, fin },
      kpis: { actual, previo },
      ingresos_semanales: ingresosSemanales,
      tratamientos,
      citas_por_odontologo: citasOdo,
      ausentismo_por_dia,
      cartera: cartera ?? { cobrado: 0, pendiente: 0, vencida: 0 },
      prediccion_pacientes: prediccion,
      prediccion_ingresos: prediccionIngresosData,
      prediccion_especialidades: prediccionEspecialidadesData,
      riesgo_inasistencia: riesgoInasistencia,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al generar el reporte' })
  }
})

export default router
