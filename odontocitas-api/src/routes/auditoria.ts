import { Router } from 'express'
import { query } from '../db/pool'
import { authenticate, authorize } from '../middleware/auth'
import type { Request, Response } from 'express'

const router = Router()
router.use(authenticate, authorize('admin'))

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { modulo, limit = 100 } = req.query
    const params: unknown[] = []
    let sql = `
      SELECT a.*, u.nombre AS usuario_nombre, u.rol AS usuario_rol
      FROM auditoria a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE 1=1
    `
    if (modulo) {
      params.push(modulo)
      sql += ` AND a.modulo = $${params.length}`
    }
    params.push(limit)
    sql += ` ORDER BY a.created_at DESC LIMIT $${params.length}`
    res.json(await query(sql, params))
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener auditoría' })
  }
})

export default router
