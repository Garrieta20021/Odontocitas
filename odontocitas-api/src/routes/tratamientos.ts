import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { query, queryOne } from '../db/pool'
import { authenticate, authorize } from '../middleware/auth'
import type { Request, Response } from 'express'

const router = Router()
router.use(authenticate)

const ESPECIALIDADES = ['general', 'ortodoncia', 'endodoncia', 'cirugia', 'blanqueamiento', 'pediatrica']

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // El admin puede ver también los inactivos para gestionarlos.
    const incluirInactivos = req.user!.rol === 'admin' && req.query.todos === 'true'
    const tratamientos = await query(
      incluirInactivos
        ? 'SELECT * FROM tratamientos ORDER BY activo DESC, nombre'
        : 'SELECT * FROM tratamientos WHERE activo = true ORDER BY nombre'
    )
    res.json(tratamientos)
  } catch {
    res.status(500).json({ error: 'Error al obtener tratamientos' })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const t = await queryOne('SELECT * FROM tratamientos WHERE id = $1', [req.params.id])
    if (!t) { res.status(404).json({ error: 'Tratamiento no encontrado' }); return }
    res.json(t)
  } catch {
    res.status(500).json({ error: 'Error al obtener tratamiento' })
  }
})

// ─── POST /api/tratamientos (admin) ───────────────────────────────
router.post('/', authorize('admin'), [
  body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
  body('tarifa').isFloat({ min: 0 }).withMessage('Tarifa inválida'),
  body('duracion_minutos').optional().isInt({ min: 5 }).withMessage('Duración inválida'),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

  const { nombre, descripcion, duracion_minutos, tarifa, especialidad } = req.body
  const esp = ESPECIALIDADES.includes(especialidad) ? especialidad : 'general'

  try {
    const t = await queryOne(
      `INSERT INTO tratamientos (nombre, descripcion, duracion_minutos, tarifa, especialidad)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, descripcion ?? null, duracion_minutos ?? 45, tarifa, esp]
    )
    res.status(201).json(t)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear tratamiento' })
  }
})

// ─── PUT /api/tratamientos/:id (admin) ────────────────────────────
router.put('/:id', authorize('admin'), [
  body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
  body('tarifa').isFloat({ min: 0 }).withMessage('Tarifa inválida'),
  body('duracion_minutos').optional().isInt({ min: 5 }).withMessage('Duración inválida'),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

  const { nombre, descripcion, duracion_minutos, tarifa, especialidad, activo } = req.body
  const esp = ESPECIALIDADES.includes(especialidad) ? especialidad : 'general'

  try {
    const t = await queryOne(
      `UPDATE tratamientos SET
         nombre = $2, descripcion = $3, duracion_minutos = $4,
         tarifa = $5, especialidad = $6, activo = COALESCE($7, activo)
       WHERE id = $1 RETURNING *`,
      [req.params.id, nombre, descripcion ?? null, duracion_minutos ?? 45, tarifa, esp, activo ?? null]
    )
    if (!t) { res.status(404).json({ error: 'Tratamiento no encontrado' }); return }
    res.json(t)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar tratamiento' })
  }
})

// ─── DELETE /api/tratamientos/:id (admin) ─────────────────────────
// Desactivación lógica para preservar el histórico de citas/facturas.
router.delete('/:id', authorize('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const t = await queryOne(
      'UPDATE tratamientos SET activo = false WHERE id = $1 RETURNING id',
      [req.params.id]
    )
    if (!t) { res.status(404).json({ error: 'Tratamiento no encontrado' }); return }
    res.json({ message: 'Tratamiento desactivado' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al desactivar tratamiento' })
  }
})

export default router
