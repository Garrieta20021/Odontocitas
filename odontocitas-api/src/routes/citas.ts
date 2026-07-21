import { Router } from 'express'
import { body, query as qv, validationResult } from 'express-validator'
import { pool, query, queryOne } from '../db/pool'
import { authenticate, authorize } from '../middleware/auth'
import { notificarSolicitudCitaAAdmins, notificarRespuestaCitaAlPaciente, notificarReprogramacionCitaAAdmins } from '../services/notificaciones'
import { generarFacturaParaCita } from '../services/facturacion'
import { registrarAuditoria } from '../services/auditoria'
import { notificarConfirmacionCitaWhatsapp, ofrecerEspacioListaEspera, recomendarControlPostCitaWhatsapp } from '../services/citas.service'
import type { Request, Response } from 'express'

const router = Router()

// Rutas públicas para enlaces de confirmación enviados al paciente.
// Se identifican por el token aleatorio de la cita (no por su id), para que
// no se pueda enumerar ni manipular conociendo solo el id.
router.get('/publica/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const cita = await queryOne(`
      SELECT
        c.id, c.fecha_hora, c.estado, c.motivo, c.notas_clinicas,
        c.duracion_minutos,
        up.nombre AS paciente_nombre, up.cedula AS paciente_cedula,
        up.telefono AS paciente_telefono, up.email AS paciente_email,
        pac.id AS paciente_id,
        uo.nombre AS odontologo_nombre,
        od.id AS odontologo_id,
        t.nombre AS tratamiento_nombre, t.tarifa, t.duracion_minutos AS tratamiento_duracion
      FROM citas c
      JOIN pacientes pac ON c.paciente_id = pac.id
      JOIN usuarios up ON pac.usuario_id = up.id
      JOIN odontologos od ON c.odontologo_id = od.id
      JOIN usuarios uo ON od.usuario_id = uo.id
      LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
      WHERE c.token_confirmacion = $1
    `, [req.params.token])

    if (!cita) {
      res.status(404).json({ error: 'Cita no encontrada' })
      return
    }
    res.json(cita)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener cita' })
  }
})

router.patch('/publica/:token/:accion', async (req: Request, res: Response): Promise<void> => {
  const estado = req.params.accion === 'confirmar'
    ? 'confirmada'
    : req.params.accion === 'cancelar'
      ? 'cancelada'
      : null

  if (!estado) {
    res.status(400).json({ error: 'Acción no permitida' })
    return
  }

  try {
    // Solo se puede confirmar/cancelar una cita que siga pendiente o confirmada.
    const actual = await queryOne<{ id: string; estado: string }>(
      `SELECT id, estado FROM citas WHERE token_confirmacion = $1`,
      [req.params.token]
    )
    if (!actual) {
      res.status(404).json({ error: 'Cita no encontrada' })
      return
    }
    if (!['pendiente', 'confirmada'].includes(actual.estado)) {
      res.status(409).json({ error: `La cita ya está ${actual.estado} y no se puede modificar` })
      return
    }

    const confirmadoEn = estado === 'confirmada' ? new Date().toISOString() : null
    const cita = await queryOne(
      `UPDATE citas
       SET estado = $2,
           confirmado_en = COALESCE($3::timestamptz, confirmado_en),
           updated_at = NOW()
       WHERE token_confirmacion = $1
       RETURNING *`,
      [req.params.token, estado, confirmadoEn]
    )

    // Al confirmar la cita desde el enlace público, enviar la confirmación por WhatsApp.
    if (estado === 'confirmada' && actual.id) {
      try {
        await notificarConfirmacionCitaWhatsapp(actual.id)
      } catch (waErr) {
        console.error('No se pudo enviar la confirmación por WhatsApp:', waErr)
      }
    }
    if (estado === 'cancelada' && actual.id) {
      try {
        await ofrecerEspacioListaEspera(actual.id)
      } catch (esperaErr) {
        console.error('No se pudo activar la lista de espera:', esperaErr)
      }
    }

    res.json(cita)
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar cita' })
  }
})

// Todas las rutas privadas requieren autenticacion
router.use(authenticate)

// ─── GET /api/citas ───────────────────────────────────────────────
// Lista citas con filtros opcionales
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { estado, odontologo_id, paciente_id, fecha_desde, fecha_hasta, limit = 50, offset = 0 } = req.query

    let sql = `
      SELECT
        c.id, c.fecha_hora, c.estado, c.motivo, c.notas_clinicas,
        c.duracion_minutos, c.created_at,
        up.nombre AS paciente_nombre, up.cedula AS paciente_cedula,
        pac.id AS paciente_id,
        uo.nombre AS odontologo_nombre,
        od.id AS odontologo_id,
        t.nombre AS tratamiento_nombre, t.tarifa, t.duracion_minutos AS tratamiento_duracion
      FROM citas c
      JOIN pacientes pac ON c.paciente_id = pac.id
      JOIN usuarios up ON pac.usuario_id = up.id
      JOIN odontologos od ON c.odontologo_id = od.id
      JOIN usuarios uo ON od.usuario_id = uo.id
      LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
      WHERE 1=1
    `
    const params: unknown[] = []
    let i = 1

    if (estado) { sql += ` AND c.estado = $${i++}`; params.push(estado) }
    if (odontologo_id) { sql += ` AND c.odontologo_id = $${i++}`; params.push(odontologo_id) }
    if (paciente_id) { sql += ` AND c.paciente_id = $${i++}`; params.push(paciente_id) }
    if (fecha_desde) { sql += ` AND c.fecha_hora >= $${i++}`; params.push(fecha_desde) }
    if (fecha_hasta) { sql += ` AND c.fecha_hora <= $${i++}`; params.push(fecha_hasta) }

    // Si es odontólogo, solo ve sus citas
    if (req.user!.rol === 'odontologo') {
      sql += ` AND od.usuario_id = $${i++}`
      params.push(req.user!.userId)
    }
    // Si es paciente, solo ve las suyas
    if (req.user!.rol === 'paciente') {
      sql += ` AND up.id = $${i++}`
      params.push(req.user!.userId)
    }

    sql += ` ORDER BY c.fecha_hora DESC LIMIT $${i++} OFFSET $${i++}`
    params.push(limit, offset)

    const citas = await query(sql, params)
    res.json(citas)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener citas' })
  }
})

// ─── GET /api/citas/hoy ───────────────────────────────────────────
router.get('/hoy', async (req: Request, res: Response): Promise<void> => {
  try {
    let sql = `
      SELECT
        c.id, c.fecha_hora, c.estado, c.duracion_minutos,
        up.nombre AS paciente_nombre, up.cedula AS paciente_cedula,
        pac.id AS paciente_id,
        uo.nombre AS odontologo_nombre,
        t.nombre AS tratamiento_nombre
      FROM citas c
      JOIN pacientes pac ON c.paciente_id = pac.id
      JOIN usuarios up ON pac.usuario_id = up.id
      JOIN odontologos od ON c.odontologo_id = od.id
      JOIN usuarios uo ON od.usuario_id = uo.id
      LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
      WHERE DATE(c.fecha_hora) = CURRENT_DATE
    `
    const params: unknown[] = []
    let i = 1

    if (req.user!.rol === 'odontologo') {
      sql += ` AND od.usuario_id = $${i++}`
      params.push(req.user!.userId)
    }

    sql += ' ORDER BY c.fecha_hora ASC'
    const citas = await query(sql, params)
    res.json(citas)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener citas de hoy' })
  }
})

// ─── GET /api/citas/:id ───────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const cita = await queryOne<Record<string, unknown>>(`
      SELECT
        c.*,
        up.nombre AS paciente_nombre, up.cedula AS paciente_cedula,
        up.telefono AS paciente_telefono, up.email AS paciente_email,
        up.id AS paciente_usuario_id,
        pac.id AS paciente_id, pac.alergias, pac.grupo_sanguineo, pac.eps,
        uo.nombre AS odontologo_nombre,
        uo.id AS odontologo_usuario_id,
        od.id AS odontologo_id, od.especialidad,
        t.nombre AS tratamiento_nombre, t.tarifa, t.duracion_minutos AS tratamiento_duracion
      FROM citas c
      JOIN pacientes pac ON c.paciente_id = pac.id
      JOIN usuarios up ON pac.usuario_id = up.id
      JOIN odontologos od ON c.odontologo_id = od.id
      JOIN usuarios uo ON od.usuario_id = uo.id
      LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
      WHERE c.id = $1
    `, [req.params.id])

    if (!cita) {
      res.status(404).json({ error: 'Cita no encontrada' })
      return
    }

    // Un paciente solo puede ver sus citas; un odontólogo, las suyas.
    const rol = req.user!.rol
    if (rol === 'paciente' && cita.paciente_usuario_id !== req.user!.userId) {
      res.status(403).json({ error: 'Sin permisos para ver esta cita' })
      return
    }
    if (rol === 'odontologo' && cita.odontologo_usuario_id !== req.user!.userId) {
      res.status(403).json({ error: 'Sin permisos para ver esta cita' })
      return
    }

    delete cita.paciente_usuario_id
    delete cita.odontologo_usuario_id
    res.json(cita)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener cita' })
  }
})

// ─── POST /api/citas ─────────────────────────────────────────────
router.post('/', authorize('admin', 'paciente'), [
  body('paciente_id').notEmpty().withMessage('Paciente requerido'),
  body('odontologo_id').notEmpty().withMessage('Odontólogo requerido'),
  body('tratamiento_id').notEmpty().withMessage('Tratamiento requerido'),
  body('fecha_hora').isISO8601().withMessage('Fecha inválida'),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() })
    return
  }

  const { paciente_id, odontologo_id, tratamiento_id, fecha_hora, motivo, duracion_minutos } = req.body
  const duracion = duracion_minutos ?? 45

  try {
    // Verificar disponibilidad considerando la duración: hay conflicto si los
    // intervalos [inicio, inicio+duración) de la nueva cita y de una existente
    // se solapan para el mismo odontólogo.
    const conflicto = await queryOne(
      `SELECT id FROM citas
       WHERE odontologo_id = $1
       AND estado NOT IN ('cancelada', 'reprogramada')
       AND fecha_hora < ($2::timestamptz + ($3 || ' minutes')::interval)
       AND (fecha_hora + (duracion_minutos || ' minutes')::interval) > $2::timestamptz`,
      [odontologo_id, fecha_hora, duracion]
    )
    if (conflicto) {
      res.status(409).json({ error: 'El odontólogo ya tiene una cita que se cruza con ese horario' })
      return
    }

    const nuevaCita = await queryOne<{ id: string }>(`
      INSERT INTO citas (paciente_id, odontologo_id, tratamiento_id, fecha_hora, motivo, duracion_minutos)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [paciente_id, odontologo_id, tratamiento_id, fecha_hora, motivo, duracion])
    if (!nuevaCita) {
      res.status(500).json({ error: 'Error al crear cita' })
      return
    }

    // Si la solicitud la genera un paciente, avisar a los administradores
    // para que puedan aceptarla o rechazarla. No bloquea la creación de la cita.
    if (req.user!.rol === 'paciente') {
      try {
        await notificarSolicitudCitaAAdmins(nuevaCita.id)
      } catch (notifErr) {
        console.error('No se pudo notificar la solicitud de cita:', notifErr)
      }
    }

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'citas',
      accion: 'crear_cita',
      entidad: 'citas',
      entidadId: nuevaCita.id,
      detalle: { paciente_id, odontologo_id, tratamiento_id, fecha_hora, rol: req.user!.rol },
    })
    res.status(201).json(nuevaCita)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear cita' })
  }
})

// ─── PATCH /api/citas/:id ─────────────────────────────────────────
router.patch('/:id', authorize('admin', 'odontologo'), async (req: Request, res: Response): Promise<void> => {
  const allowed = ['estado', 'notas_clinicas', 'motivo_cancelacion', 'fecha_hora', 'odontologo_id']
  const updates: Record<string, unknown> = {}

  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key]
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No hay campos para actualizar' })
    return
  }

  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
  const values = Object.values(updates)

  try {
    const cita = await queryOne(
      `UPDATE citas SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, ...values]
    )
    if (!cita) {
      res.status(404).json({ error: 'Cita no encontrada' })
      return
    }

    // Al aceptar (confirmada) o rechazar (cancelada) una solicitud, avisar al paciente.
    if (updates.estado === 'confirmada' || updates.estado === 'cancelada') {
      try {
        await notificarRespuestaCitaAlPaciente(req.params.id, updates.estado as string)
      } catch (notifErr) {
        console.error('No se pudo notificar la respuesta de la cita:', notifErr)
      }
    }

    // Al confirmar la cita, enviar también la confirmación por WhatsApp al paciente.
    if (updates.estado === 'confirmada') {
      try {
        await notificarConfirmacionCitaWhatsapp(req.params.id)
      } catch (waErr) {
        console.error('No se pudo enviar la confirmación por WhatsApp:', waErr)
      }
    }
    if (updates.estado === 'cancelada') {
      try {
        await ofrecerEspacioListaEspera(req.params.id)
      } catch (esperaErr) {
        console.error('No se pudo activar la lista de espera:', esperaErr)
      }
    }

    // Al completar la cita, generar su factura automáticamente (idempotente).
    if (updates.estado === 'completada') {
      try {
        await generarFacturaParaCita(req.params.id)
      } catch (factErr) {
        console.error('No se pudo generar la factura de la cita:', factErr)
      }
      try {
        await recomendarControlPostCitaWhatsapp(req.params.id)
      } catch (controlErr) {
        console.error('No se pudo enviar recomendación de control por WhatsApp:', controlErr)
      }
    }

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'citas',
      accion: 'actualizar_cita',
      entidad: 'citas',
      entidadId: req.params.id,
      detalle: updates,
    })
    res.json(cita)
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar cita' })
  }
})

// ─── PATCH /api/citas/:id/cancelar ───────────────────────────────
// El paciente puede cancelar su propia cita; admin y odontólogo cualquiera.
router.patch('/:id/cancelar', async (req: Request, res: Response): Promise<void> => {
  try {
    const cita = await queryOne<{ id: string; estado: string; paciente_usuario_id: string; odontologo_usuario_id: string }>(`
      SELECT c.id, c.estado,
             up.id AS paciente_usuario_id,
             uo.id AS odontologo_usuario_id
      FROM citas c
      JOIN pacientes pac ON c.paciente_id = pac.id
      JOIN usuarios up ON pac.usuario_id = up.id
      JOIN odontologos od ON c.odontologo_id = od.id
      JOIN usuarios uo ON od.usuario_id = uo.id
      WHERE c.id = $1
    `, [req.params.id])

    if (!cita) {
      res.status(404).json({ error: 'Cita no encontrada' })
      return
    }

    const rol = req.user!.rol
    const esDueño =
      (rol === 'paciente' && cita.paciente_usuario_id === req.user!.userId) ||
      (rol === 'odontologo' && cita.odontologo_usuario_id === req.user!.userId) ||
      rol === 'admin'
    if (!esDueño) {
      res.status(403).json({ error: 'Sin permisos para cancelar esta cita' })
      return
    }

    if (['completada', 'cancelada'].includes(cita.estado)) {
      res.status(409).json({ error: `La cita ya está ${cita.estado}` })
      return
    }

    const actualizada = await queryOne(
      `UPDATE citas
       SET estado = 'cancelada',
           motivo_cancelacion = COALESCE($2, motivo_cancelacion),
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, req.body?.motivo_cancelacion ?? null]
    )

    try {
      await notificarRespuestaCitaAlPaciente(req.params.id, 'cancelada')
    } catch (notifErr) {
      console.error('No se pudo notificar la cancelación de la cita:', notifErr)
    }
    try {
      await ofrecerEspacioListaEspera(req.params.id)
    } catch (esperaErr) {
      console.error('No se pudo activar la lista de espera:', esperaErr)
    }

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'citas',
      accion: 'cancelar_cita',
      entidad: 'citas',
      entidadId: req.params.id,
      detalle: { motivo_cancelacion: req.body?.motivo_cancelacion ?? null, rol: req.user!.rol },
    })
    res.json(actualizada)
  } catch (err) {
    res.status(500).json({ error: 'Error al cancelar cita' })
  }
})

// ─── PATCH /api/citas/:id/reprogramar ────────────────────────────
// El paciente reprograma su propia cita (admin/odontólogo también). Valida que
// el odontólogo esté libre en el nuevo horario y deja la cita en 'reprogramada'
// para que el administrador la apruebe; le llega una notificación.
router.patch('/:id/reprogramar', async (req: Request, res: Response): Promise<void> => {
  const { fecha_hora } = req.body as { fecha_hora?: string; odontologo_id?: string }

  if (!fecha_hora || isNaN(Date.parse(fecha_hora))) {
    res.status(400).json({ error: 'Fecha inválida' })
    return
  }

  try {
    const cita = await queryOne<{
      id: string
      estado: string
      odontologo_id: string
      duracion_minutos: number
      paciente_usuario_id: string
      odontologo_usuario_id: string
    }>(`
      SELECT c.id, c.estado, c.odontologo_id, c.duracion_minutos,
             up.id AS paciente_usuario_id,
             uo.id AS odontologo_usuario_id
      FROM citas c
      JOIN pacientes pac ON c.paciente_id = pac.id
      JOIN usuarios up ON pac.usuario_id = up.id
      JOIN odontologos od ON c.odontologo_id = od.id
      JOIN usuarios uo ON od.usuario_id = uo.id
      WHERE c.id = $1
    `, [req.params.id])

    if (!cita) {
      res.status(404).json({ error: 'Cita no encontrada' })
      return
    }

    const rol = req.user!.rol
    const esDueño =
      rol === 'admin' ||
      (rol === 'paciente' && cita.paciente_usuario_id === req.user!.userId) ||
      (rol === 'odontologo' && cita.odontologo_usuario_id === req.user!.userId)
    if (!esDueño) {
      res.status(403).json({ error: 'Sin permisos para reprogramar esta cita' })
      return
    }

    if (['completada', 'cancelada'].includes(cita.estado)) {
      res.status(409).json({ error: `La cita ya está ${cita.estado} y no se puede reprogramar` })
      return
    }

    const odontologoId = (req.body.odontologo_id as string) || cita.odontologo_id
    const duracion = cita.duracion_minutos ?? 45

    // Verificar disponibilidad (solapamiento por duración), excluyendo esta cita.
    const conflicto = await queryOne(
      `SELECT id FROM citas
       WHERE odontologo_id = $1
       AND id <> $2
       AND estado NOT IN ('cancelada', 'reprogramada')
       AND fecha_hora < ($3::timestamptz + ($4 || ' minutes')::interval)
       AND (fecha_hora + (duracion_minutos || ' minutes')::interval) > $3::timestamptz`,
      [odontologoId, req.params.id, fecha_hora, duracion]
    )
    if (conflicto) {
      res.status(409).json({ error: 'El odontólogo no está disponible en ese horario' })
      return
    }

    // Nueva fecha propuesta queda en reprogramada hasta que el administrador la confirme.
    const actualizada = await queryOne(
      `UPDATE citas
       SET fecha_hora = $2, odontologo_id = $3, estado = 'reprogramada', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, fecha_hora, odontologoId]
    )

    try {
      await notificarReprogramacionCitaAAdmins(req.params.id)
    } catch (notifErr) {
      console.error('No se pudo notificar la reprogramación:', notifErr)
    }

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'citas',
      accion: 'reprogramar_cita',
      entidad: 'citas',
      entidadId: req.params.id,
      detalle: { fecha_hora, odontologo_id: odontologoId, rol: req.user!.rol },
    })
    res.json(actualizada)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al reprogramar cita' })
  }
})

// ─── DELETE /api/citas/:id (cancelar) ────────────────────────────
router.delete('/:id', authorize('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    await query(
      `UPDATE citas SET estado = 'cancelada', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    )
    try {
      await ofrecerEspacioListaEspera(req.params.id)
    } catch (esperaErr) {
      console.error('No se pudo activar la lista de espera:', esperaErr)
    }
    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'citas',
      accion: 'cancelar_cita_admin',
      entidad: 'citas',
      entidadId: req.params.id,
    })
    res.json({ message: 'Cita cancelada' })
  } catch (err) {
    res.status(500).json({ error: 'Error al cancelar cita' })
  }
})

export default router
