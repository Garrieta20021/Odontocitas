import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { query, queryOne } from '../db/pool'
import { authenticate, authorize } from '../middleware/auth'
import { crearNotificacion } from '../services/notificaciones'
import type { Request, Response } from 'express'

const router = Router()
router.use(authenticate)

// ─── GET /api/notificaciones/resumen ──────────────────────────────
// Conteo del día para el panel del administrador.
router.get('/resumen', async (req: Request, res: Response): Promise<void> => {
  try {
    // Actividad de toda la clínica para hoy + el "sin leer" del propio usuario.
    const resumen = await queryOne(`
      SELECT
        COUNT(*) FILTER (WHERE tipo = 'recordatorio' AND created_at::date = CURRENT_DATE)::int AS recordatorios,
        COUNT(*) FILTER (WHERE tipo = 'confirmacion' AND created_at::date = CURRENT_DATE)::int AS confirmaciones,
        COUNT(*) FILTER (WHERE tipo = 'solicitud'    AND created_at::date = CURRENT_DATE)::int AS solicitudes,
        COUNT(*) FILTER (WHERE tipo = 'cancelacion'  AND created_at::date = CURRENT_DATE)::int AS cancelaciones,
        COUNT(*) FILTER (WHERE leido = false AND usuario_id = $1)::int AS sin_leer
      FROM notificaciones
    `, [req.user!.userId])
    res.json(resumen)
  } catch {
    res.status(500).json({ error: 'Error al obtener resumen' })
  }
})

// ─── POST /api/notificaciones/recordatorio ────────────────────────
// El administrador envía un recordatorio manual a un paciente.
router.post('/recordatorio', authorize('admin'), [
  body('paciente_id').notEmpty().withMessage('Paciente requerido'),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() })
    return
  }

  const { paciente_id, canal, mensaje } = req.body

  try {
    const info = await queryOne<{ usuario_id: string; nombre: string }>(
      `SELECT u.id AS usuario_id, u.nombre
       FROM pacientes p JOIN usuarios u ON p.usuario_id = u.id
       WHERE p.id = $1`,
      [paciente_id]
    )
    if (!info) {
      res.status(404).json({ error: 'Paciente no encontrado' })
      return
    }

    // Próxima cita del paciente (si existe) para enriquecer el mensaje.
    const proxima = await queryOne<{ fecha_hora: string }>(
      `SELECT fecha_hora FROM citas
       WHERE paciente_id = $1 AND estado NOT IN ('cancelada','completada') AND fecha_hora >= NOW()
       ORDER BY fecha_hora ASC LIMIT 1`,
      [paciente_id]
    )

    const texto = mensaje?.trim()
      ? mensaje.trim()
      : proxima
        ? `Hola ${info.nombre}, te recordamos tu próxima cita el ${new Date(proxima.fecha_hora).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })}.`
        : `Hola ${info.nombre}, te recordamos mantener al día tus controles odontológicos.`

    await crearNotificacion({
      usuarioId: info.usuario_id,
      tipo: 'recordatorio',
      titulo: 'Recordatorio de la clínica',
      mensaje: texto,
      canal: canal ?? 'sistema',
    })

    res.status(201).json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error al enviar recordatorio' })
  }
})

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const notifs = await query(`
      SELECT n.*,
             n.mensaje AS descripcion,
             c.fecha_hora,
             c.estado AS cita_estado,
             c.estado AS estado,
             up.nombre AS paciente_nombre
      FROM notificaciones n
      LEFT JOIN citas c ON n.cita_id = c.id
      LEFT JOIN pacientes pac ON c.paciente_id = pac.id
      LEFT JOIN usuarios up ON pac.usuario_id = up.id
      WHERE n.usuario_id = $1
      ORDER BY n.created_at DESC LIMIT 50
    `, [req.user!.userId])
    res.json(notifs)
  } catch {
    res.status(500).json({ error: 'Error al obtener notificaciones' })
  }
})

router.patch('/:id/leer', async (req: Request, res: Response): Promise<void> => {
  try {
    await queryOne(
      'UPDATE notificaciones SET leido = true WHERE id = $1 AND usuario_id = $2',
      [req.params.id, req.user!.userId]
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error al marcar notificación' })
  }
})

router.patch('/leer-todas', async (req: Request, res: Response): Promise<void> => {
  try {
    await query(
      'UPDATE notificaciones SET leido = true WHERE usuario_id = $1',
      [req.user!.userId]
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error' })
  }
})

export default router
