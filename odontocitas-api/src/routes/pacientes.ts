import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import bcrypt from 'bcryptjs'
import { pool, query, queryOne } from '../db/pool'
import { authenticate, authorize } from '../middleware/auth'
import { registrarAuditoria } from '../services/auditoria'
import type { Request, Response } from 'express'

const router = Router()
router.use(authenticate)

// Verifica que un paciente solo pueda acceder a su propio perfil clínico.
// admin y odontólogo pueden ver cualquiera.
async function puedeVerPaciente(req: Request, pacienteId: string): Promise<boolean> {
  if (req.user!.rol !== 'paciente') return true
  const row = await queryOne<{ usuario_id: string }>(
    'SELECT usuario_id FROM pacientes WHERE id = $1',
    [pacienteId]
  )
  return !!row && row.usuario_id === req.user!.userId
}

// ─── GET /api/pacientes ───────────────────────────────────────────
router.get('/', authorize('admin', 'odontologo'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { busqueda, activo, limit = 50, offset = 0 } = req.query

    let sql = `
      SELECT
        p.id, p.activo, p.fecha_nacimiento, p.grupo_sanguineo, p.eps, p.alergias,
        u.nombre, u.cedula, u.email, u.telefono,
        EXTRACT(YEAR FROM AGE(p.fecha_nacimiento))::int AS edad,
        COUNT(DISTINCT c.id)::int AS total_citas,
        MAX(c.fecha_hora) AS ultima_visita
      FROM pacientes p
      JOIN usuarios u ON p.usuario_id = u.id
      LEFT JOIN citas c ON c.paciente_id = p.id AND c.estado != 'cancelada'
      WHERE 1=1
    `
    const params: unknown[] = []
    let i = 1

    if (busqueda) {
      sql += ` AND (u.nombre ILIKE $${i} OR u.cedula ILIKE $${i} OR u.telefono ILIKE $${i})`
      params.push(`%${busqueda}%`)
      i++
    }
    if (activo !== undefined) {
      sql += ` AND p.activo = $${i++}`
      params.push(activo === 'true')
    }

    sql += ` GROUP BY p.id, u.nombre, u.cedula, u.email, u.telefono
             ORDER BY u.nombre ASC LIMIT $${i++} OFFSET $${i++}`
    params.push(limit, offset)

    const pacientes = await query(sql, params)
    res.json(pacientes)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener pacientes' })
  }
})

// ─── GET /api/pacientes/:id ───────────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!(await puedeVerPaciente(req, req.params.id))) {
      res.status(403).json({ error: 'Sin permisos para ver este paciente' })
      return
    }
    const paciente = await queryOne(`
      SELECT
        p.*, u.nombre, u.cedula, u.email, u.telefono,
        EXTRACT(YEAR FROM AGE(p.fecha_nacimiento))::int AS edad
      FROM pacientes p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.id = $1
    `, [req.params.id])

    if (!paciente) {
      res.status(404).json({ error: 'Paciente no encontrado' })
      return
    }
    res.json(paciente)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener paciente' })
  }
})

// ─── GET /api/pacientes/:id/historia ─────────────────────────────
router.get('/:id/historia', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!(await puedeVerPaciente(req, req.params.id))) {
      res.status(403).json({ error: 'Sin permisos para ver esta historia clínica' })
      return
    }
    const historia = await query(`
      SELECT
        h.*, uo.nombre AS odontologo_nombre,
        c.fecha_hora, c.estado AS cita_estado
      FROM historia_clinica h
      LEFT JOIN odontologos od ON h.odontologo_id = od.id
      LEFT JOIN usuarios uo ON od.usuario_id = uo.id
      LEFT JOIN citas c ON h.cita_id = c.id
      WHERE h.paciente_id = $1
      ORDER BY h.fecha DESC
    `, [req.params.id])
    res.json(historia)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener historia clínica' })
  }
})

// ─── GET /api/pacientes/:id/odontograma ──────────────────────────
router.get('/:id/odontograma', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!(await puedeVerPaciente(req, req.params.id))) {
      res.status(403).json({ error: 'Sin permisos para ver este odontograma' })
      return
    }
    const dientes = await query(
      'SELECT numero_diente, estado, notas FROM odontograma WHERE paciente_id = $1',
      [req.params.id]
    )
    res.json(dientes)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener odontograma' })
  }
})

// ─── POST /api/pacientes ──────────────────────────────────────────
router.post('/', authorize('admin'), [
  body('cedula').notEmpty().withMessage('Cédula requerida'),
  body('nombre').notEmpty().withMessage('Nombre requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('telefono').notEmpty().withMessage('Teléfono requerido'),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() })
    return
  }

  const {
    cedula, nombre, email, telefono,
    fecha_nacimiento, grupo_sanguineo, eps,
    alergias, enfermedades, medicamentos, motivo, password
  } = req.body

  // Normalizar igual que en el login (quita puntos y espacios) para que la
  // cédula almacenada y la contraseña inicial coincidan con lo que se teclea.
  const cedulaNorm = String(cedula).replace(/[\.\s]/g, '')

  // Si el admin (o el paciente) define una contraseña, se usa esa; de lo
  // contrario, la contraseña inicial sigue siendo la cédula.
  const passwordPersonalizada = typeof password === 'string' ? password.trim() : ''
  if (passwordPersonalizada && passwordPersonalizada.length < 6) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
    return
  }
  const passwordFinal = passwordPersonalizada || cedulaNorm
  const passwordEsPersonalizada = Boolean(passwordPersonalizada)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const passwordHash = await bcrypt.hash(passwordFinal, 10)
    const usuarioRes = await client.query(
      `INSERT INTO usuarios (cedula, nombre, email, telefono, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5, 'paciente')
       RETURNING id`,
      [cedulaNorm, nombre, email, telefono, passwordHash]
    )
    const usuarioId = usuarioRes.rows[0].id

    // Crear perfil paciente
    const pacienteRes = await client.query(
      `INSERT INTO pacientes (usuario_id, fecha_nacimiento, grupo_sanguineo, eps, alergias, enfermedades, medicamentos)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [usuarioId, fecha_nacimiento, grupo_sanguineo, eps,
       alergias ?? [], enfermedades ?? [], medicamentos]
    )

    await client.query('COMMIT')
    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'pacientes',
      accion: 'crear_paciente',
      entidad: 'pacientes',
      entidadId: pacienteRes.rows[0].id,
      detalle: { cedula: cedulaNorm, nombre, password_personalizada: passwordEsPersonalizada },
    })
    res.status(201).json({
      id: pacienteRes.rows[0].id,
      usuario_id: usuarioId,
      nombre, cedula: cedulaNorm, email, telefono,
      credenciales: {
        usuario: cedulaNorm,
        password_inicial: passwordFinal,
        password_personalizada: passwordEsPersonalizada,
        rol: 'paciente',
      },
      message: passwordEsPersonalizada
        ? 'Paciente registrado con contraseña personalizada.'
        : 'Paciente registrado. Contraseña inicial: número de cédula'
    })
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const e = err as { code?: string }
    if (e.code === '23505') {
      res.status(409).json({ error: 'Ya existe un paciente con esa cédula o email' })
    } else {
      res.status(500).json({ error: 'Error al registrar paciente' })
    }
  } finally {
    client.release()
  }
})

// ─── PUT /api/pacientes/:id ───────────────────────────────────────
router.put('/:id', authorize('admin'), async (req: Request, res: Response): Promise<void> => {
  const { grupo_sanguineo, eps, alergias, enfermedades, medicamentos, activo } = req.body

  try {
    const paciente = await queryOne(
      `UPDATE pacientes
       SET grupo_sanguineo = COALESCE($1, grupo_sanguineo),
           eps = COALESCE($2, eps),
           alergias = COALESCE($3, alergias),
           enfermedades = COALESCE($4, enfermedades),
           medicamentos = COALESCE($5, medicamentos),
           activo = COALESCE($6, activo),
           updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [grupo_sanguineo, eps, alergias, enfermedades, medicamentos, activo, req.params.id]
    )
    if (paciente) {
      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'pacientes',
        accion: 'actualizar_paciente',
        entidad: 'pacientes',
        entidadId: req.params.id,
        detalle: req.body,
      })
    }
    res.json(paciente)
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar paciente' })
  }
})

// ─── DELETE /api/pacientes/:id ────────────────────────────────────
// Elimina permanentemente al paciente y todo lo asociado (usuario de acceso,
// citas, historia clínica, facturas, odontograma y notificaciones).
router.delete('/:id', authorize('admin'), async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect()
  try {
    const paciente = await client.query<{ usuario_id: string }>(
      'SELECT usuario_id FROM pacientes WHERE id = $1',
      [req.params.id]
    )
    if (paciente.rowCount === 0) {
      res.status(404).json({ error: 'Paciente no encontrado' })
      return
    }
    const usuarioId = paciente.rows[0].usuario_id

    await client.query('BEGIN')
    await client.query('DELETE FROM odontograma WHERE paciente_id = $1', [req.params.id])
    await client.query('DELETE FROM historia_clinica WHERE paciente_id = $1', [req.params.id])
    await client.query('DELETE FROM facturas WHERE paciente_id = $1', [req.params.id])
    await client.query(
      `DELETE FROM notificaciones
       WHERE usuario_id = $2
       OR cita_id IN (SELECT id FROM citas WHERE paciente_id = $1)`,
      [req.params.id, usuarioId]
    )
    await client.query('DELETE FROM citas WHERE paciente_id = $1', [req.params.id])
    await client.query('DELETE FROM pacientes WHERE id = $1', [req.params.id])
    await client.query('DELETE FROM usuarios WHERE id = $1', [usuarioId])
    await client.query('COMMIT')
    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'pacientes',
      accion: 'eliminar_paciente',
      entidad: 'pacientes',
      entidadId: req.params.id,
    })

    res.json({ message: 'Paciente eliminado' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error al eliminar paciente:', err)
    res.status(500).json({ error: 'Error al eliminar paciente' })
  } finally {
    client.release()
  }
})

// ─── POST /api/pacientes/:id/historia ────────────────────────────
router.post('/:id/historia', authorize('admin', 'odontologo'), [
  body('tratamiento_realizado').notEmpty(),
], async (req: Request, res: Response): Promise<void> => {
  const { cita_id, odontologo_id, tratamiento_realizado, hallazgos, notas, recomendaciones, materiales_usados, duracion_real } = req.body
  try {
    const registro = await queryOne(
      `INSERT INTO historia_clinica
       (paciente_id, cita_id, odontologo_id, tratamiento_realizado, hallazgos, notas, recomendaciones, materiales_usados, duracion_real)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.id, cita_id, odontologo_id, tratamiento_realizado, hallazgos, notas, recomendaciones, materiales_usados, duracion_real]
    )
    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'historia_clinica',
      accion: 'agregar_nota',
      entidad: 'historia_clinica',
      entidadId: (registro as { id?: string } | null)?.id ?? null,
      detalle: { paciente_id: req.params.id, cita_id, tratamiento_realizado },
    })
    res.status(201).json(registro)
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar nota clínica' })
  }
})

export default router
