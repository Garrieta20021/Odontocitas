import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import bcrypt from 'bcryptjs'
import { pool, query, queryOne } from '../db/pool'
import { authenticate, authorize } from '../middleware/auth'
import type { Request, Response } from 'express'

const router = Router()
router.use(authenticate)

const ESPECIALIDADES = ['general', 'ortodoncia', 'endodoncia', 'cirugia', 'blanqueamiento', 'pediatrica']

// GET /api/odontologos  (admin puede incluir inactivos con ?todos=true)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const incluirInactivos = req.user!.rol === 'admin' && req.query.todos === 'true'
    const odontologos = await query(`
      SELECT od.id, od.especialidad, od.color, od.registro_profesional, od.usuario_id,
             u.nombre, u.cedula, u.email, u.telefono, u.activo,
             COUNT(DISTINCT c.id)::int AS citas_semana
      FROM odontologos od
      JOIN usuarios u ON od.usuario_id = u.id
      LEFT JOIN citas c ON c.odontologo_id = od.id
        AND c.fecha_hora BETWEEN DATE_TRUNC('week', NOW()) AND DATE_TRUNC('week', NOW()) + INTERVAL '7 days'
        AND c.estado != 'cancelada'
      ${incluirInactivos ? '' : 'WHERE u.activo = true'}
      GROUP BY od.id, u.nombre, u.cedula, u.email, u.telefono, u.activo
      ORDER BY u.activo DESC, u.nombre
    `)
    res.json(odontologos)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener odontólogos' })
  }
})

// POST /api/odontologos (admin): crea usuario + perfil odontólogo
router.post('/', authorize('admin'), [
  body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
  body('cedula').trim().notEmpty().withMessage('Cédula requerida'),
  body('email').isEmail().withMessage('Email inválido'),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

  const { nombre, cedula, email, telefono, especialidad, color, registro_profesional } = req.body
  const cedulaNorm = String(cedula).trim()
  const esp = ESPECIALIDADES.includes(especialidad) ? especialidad : 'general'

  const client = await pool.connect()
  try {
    const existe = await client.query(
      'SELECT id FROM usuarios WHERE cedula = $1 OR email = $2',
      [cedulaNorm, email]
    )
    if (existe.rows.length > 0) {
      res.status(409).json({ error: 'Ya existe un usuario con esa cédula o correo' })
      return
    }

    await client.query('BEGIN')
    const passwordHash = await bcrypt.hash(cedulaNorm, 10)
    const usuarioRes = await client.query(
      `INSERT INTO usuarios (cedula, nombre, email, telefono, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5, 'odontologo') RETURNING id`,
      [cedulaNorm, nombre, email, telefono ?? null, passwordHash]
    )
    const usuarioId = usuarioRes.rows[0].id
    const odoRes = await client.query(
      `INSERT INTO odontologos (usuario_id, especialidad, color, registro_profesional)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [usuarioId, esp, color ?? '#C17A5A', registro_profesional ?? null]
    )
    await client.query('COMMIT')

    res.status(201).json({
      id: odoRes.rows[0].id,
      credenciales: { usuario: cedulaNorm, password_inicial: cedulaNorm, rol: 'odontologo' },
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Error al crear odontólogo' })
  } finally {
    client.release()
  }
})

// PUT /api/odontologos/:id (admin): actualiza perfil y datos del usuario
router.put('/:id', authorize('admin'), [
  body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
  body('email').isEmail().withMessage('Email inválido'),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

  const { nombre, email, telefono, especialidad, color, registro_profesional } = req.body
  const esp = ESPECIALIDADES.includes(especialidad) ? especialidad : 'general'

  const client = await pool.connect()
  try {
    const odo = await client.query('SELECT usuario_id FROM odontologos WHERE id = $1', [req.params.id])
    if (odo.rows.length === 0) { res.status(404).json({ error: 'Odontólogo no encontrado' }); return }
    const usuarioId = odo.rows[0].usuario_id

    await client.query('BEGIN')
    await client.query(
      `UPDATE odontologos SET especialidad = $2, color = $3, registro_profesional = $4 WHERE id = $1`,
      [req.params.id, esp, color ?? '#C17A5A', registro_profesional ?? null]
    )
    await client.query(
      `UPDATE usuarios SET nombre = $2, email = $3, telefono = $4, updated_at = NOW() WHERE id = $1`,
      [usuarioId, nombre, email, telefono ?? null]
    )
    await client.query('COMMIT')
    res.json({ message: 'Odontólogo actualizado' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar odontólogo' })
  } finally {
    client.release()
  }
})

// PATCH /api/odontologos/:id/activo (admin): activa/desactiva la cuenta
router.patch('/:id/activo', authorize('admin'), async (req: Request, res: Response): Promise<void> => {
  const { activo } = req.body as { activo?: boolean }
  if (typeof activo !== 'boolean') { res.status(400).json({ error: 'Valor de activo inválido' }); return }
  try {
    const odo = await queryOne<{ usuario_id: string }>(
      'SELECT usuario_id FROM odontologos WHERE id = $1', [req.params.id]
    )
    if (!odo) { res.status(404).json({ error: 'Odontólogo no encontrado' }); return }
    await queryOne(
      'UPDATE usuarios SET activo = $2, updated_at = NOW() WHERE id = $1 RETURNING id',
      [odo.usuario_id, activo]
    )
    res.json({ message: activo ? 'Odontólogo activado' : 'Odontólogo desactivado' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cambiar estado del odontólogo' })
  }
})

// GET /api/odontologos/:id/disponibilidad
router.get('/:id/disponibilidad', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fecha } = req.query
    if (!fecha) { res.status(400).json({ error: 'Fecha requerida' }); return }

    const ocupados = await query<{ hora: string }>(`
      SELECT TO_CHAR(fecha_hora, 'HH24:MI') AS hora
      FROM citas
      WHERE odontologo_id = $1
      AND DATE(fecha_hora) = $2::date
      AND estado NOT IN ('cancelada', 'reprogramada')
    `, [req.params.id, fecha])

    const horasOcupadas = ocupados.map(r => r.hora)
    const todosHorarios = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
      '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30']

    const disponibilidad = todosHorarios.map(h => ({
      hora: h,
      disponible: !horasOcupadas.includes(h)
    }))

    res.json(disponibilidad)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener disponibilidad' })
  }
})

export default router
