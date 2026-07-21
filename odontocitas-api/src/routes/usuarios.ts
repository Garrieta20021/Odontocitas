import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { query, queryOne } from '../db/pool'
import { authenticate, authorize } from '../middleware/auth'
import type { Request, Response } from 'express'

const router = Router()
router.use(authenticate)
router.use(authorize('admin'))

// GET /api/usuarios  (listado para "Usuarios y roles")
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rol } = req.query
    const params: unknown[] = []
    let where = ''
    if (rol && typeof rol === 'string') {
      params.push(rol)
      where = 'WHERE rol = $1'
    }
    const usuarios = await query(
      `SELECT id, cedula, nombre, email, telefono, rol, activo, created_at, updated_at
       FROM usuarios ${where}
       ORDER BY activo DESC, rol, nombre`,
      params
    )
    res.json(usuarios)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener usuarios' })
  }
})

// PATCH /api/usuarios/:id/activo  (activa/desactiva una cuenta)
router.patch('/:id/activo', async (req: Request, res: Response): Promise<void> => {
  const { activo } = req.body as { activo?: boolean }
  if (typeof activo !== 'boolean') { res.status(400).json({ error: 'Valor de activo inválido' }); return }
  if (req.params.id === req.user!.userId) {
    res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' })
    return
  }
  try {
    const u = await queryOne(
      'UPDATE usuarios SET activo = $2, updated_at = NOW() WHERE id = $1 RETURNING id',
      [req.params.id, activo]
    )
    if (!u) { res.status(404).json({ error: 'Usuario no encontrado' }); return }
    res.json({ message: activo ? 'Usuario activado' : 'Usuario desactivado' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cambiar estado del usuario' })
  }
})

// POST /api/usuarios/:id/reset-password  (restablece la clave a la cédula)
router.post('/:id/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const u = await queryOne<{ cedula: string }>(
      'SELECT cedula FROM usuarios WHERE id = $1', [req.params.id]
    )
    if (!u) { res.status(404).json({ error: 'Usuario no encontrado' }); return }
    const passwordHash = await bcrypt.hash(u.cedula, 10)
    await queryOne(
      'UPDATE usuarios SET password_hash = $2, updated_at = NOW() WHERE id = $1 RETURNING id',
      [req.params.id, passwordHash]
    )
    res.json({ message: 'Contraseña restablecida', password_inicial: u.cedula })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al restablecer contraseña' })
  }
})

export default router
