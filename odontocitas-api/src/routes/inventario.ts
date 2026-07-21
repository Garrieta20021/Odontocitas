import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool, query, queryOne } from '../db/pool'
import { authenticate, authorize } from '../middleware/auth'
import { registrarAuditoria } from '../services/auditoria'
import type { Request, Response } from 'express'

const router = Router()
router.use(authenticate, authorize('admin'))

function calcularEstado(stockActual: number, stockMinimo: number, fechaVencimiento?: string | null) {
  let estado = 'normal'
  if (stockActual < stockMinimo) estado = 'stock_bajo'
  if (fechaVencimiento) {
    const days = (new Date(fechaVencimiento).getTime() - Date.now()) / 86400000
    if (days < 0) estado = 'vencido'
    else if (days <= 30 && estado === 'normal') estado = 'por_vencer'
  }
  return estado
}

// GET /api/inventario
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoria, busqueda } = req.query
    let sql = 'SELECT * FROM insumos WHERE 1=1'
    const params: unknown[] = []
    let i = 1

    if (categoria) { sql += ` AND categoria = $${i++}`; params.push(categoria) }
    if (busqueda) { sql += ` AND nombre ILIKE $${i++}`; params.push(`%${busqueda}%`) }
    sql += ' ORDER BY nombre ASC'

    const insumos = await query(sql, params)
    res.json(insumos)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener inventario' })
  }
})

// GET /api/inventario/resumen
router.get('/resumen', async (_req: Request, res: Response): Promise<void> => {
  try {
    const resumen = await queryOne(`
      SELECT
        COUNT(*)::int AS total_insumos,
        COUNT(CASE WHEN estado = 'stock_bajo' THEN 1 END)::int AS stock_bajo,
        COUNT(CASE WHEN estado = 'por_vencer' THEN 1 END)::int AS por_vencer,
        COALESCE(SUM(stock_actual * COALESCE(precio_unitario, 0)), 0) AS valor_total
      FROM insumos
    `)
    res.json(resumen)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener resumen' })
  }
})

// GET /api/inventario/movimientos
router.get('/movimientos', async (req: Request, res: Response): Promise<void> => {
  try {
    const { insumo_id, limit = 20 } = req.query
    const params: unknown[] = []
    let sql = `
      SELECT m.*, i.nombre AS insumo_nombre, u.nombre AS usuario_nombre
      FROM inventario_movimientos m
      LEFT JOIN insumos i ON m.insumo_id = i.id
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE 1=1
    `
    if (insumo_id) {
      params.push(insumo_id)
      sql += ` AND m.insumo_id = $${params.length}`
    }
    params.push(limit)
    sql += ` ORDER BY m.created_at DESC LIMIT $${params.length}`
    const movimientos = await query(sql, params)
    res.json(movimientos)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener movimientos' })
  }
})

// POST /api/inventario
router.post('/', [
  body('nombre').notEmpty(),
  body('categoria').notEmpty(),
  body('stock_actual').isInt({ min: 0 }),
  body('stock_minimo').isInt({ min: 0 }),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

  const { nombre, categoria, stock_actual, stock_minimo, unidad, proveedor, precio_unitario, fecha_vencimiento } = req.body

  const estado = calcularEstado(stock_actual, stock_minimo, fecha_vencimiento)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const insumoRes = await client.query(
      `INSERT INTO insumos (nombre, categoria, stock_actual, stock_minimo, unidad, proveedor, precio_unitario, fecha_vencimiento, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [nombre, categoria, stock_actual, stock_minimo, unidad, proveedor, precio_unitario, fecha_vencimiento, estado]
    )
    const insumo = insumoRes.rows[0]
    await client.query(
      `INSERT INTO inventario_movimientos (insumo_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo)
       VALUES ($1, $2, 'entrada', $3, 0, $3, 'Registro inicial')`,
      [insumo.id, req.user!.userId, stock_actual]
    )
    await client.query('COMMIT')
    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'inventario',
      accion: 'crear_insumo',
      entidad: 'insumos',
      entidadId: insumo.id,
      detalle: { nombre, stock_actual },
    })
    res.status(201).json(insumo)
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: 'Error al crear insumo' })
  } finally {
    client.release()
  }
})

// POST /api/inventario/:id/movimiento
router.post('/:id/movimiento', [
  body('tipo').isIn(['entrada', 'salida', 'ajuste']),
  body('cantidad').isInt({ min: 1 }),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

  const { tipo, cantidad, motivo } = req.body as { tipo: 'entrada' | 'salida' | 'ajuste'; cantidad: number; motivo?: string }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const actualRes = await client.query<{
      id: string
      stock_actual: number
      stock_minimo: number
      fecha_vencimiento: string | null
    }>('SELECT id, stock_actual, stock_minimo, fecha_vencimiento FROM insumos WHERE id = $1 FOR UPDATE', [req.params.id])
    if (actualRes.rowCount === 0) {
      await client.query('ROLLBACK')
      res.status(404).json({ error: 'Insumo no encontrado' })
      return
    }
    const actual = actualRes.rows[0]
    const stockAnterior = actual.stock_actual
    const stockNuevo = tipo === 'entrada'
      ? stockAnterior + cantidad
      : tipo === 'salida'
        ? Math.max(0, stockAnterior - cantidad)
        : cantidad
    const estado = calcularEstado(stockNuevo, actual.stock_minimo, actual.fecha_vencimiento)

    const insumoRes = await client.query(
      `UPDATE insumos SET stock_actual = $1, estado = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [stockNuevo, estado, req.params.id]
    )
    await client.query(
      `INSERT INTO inventario_movimientos
       (insumo_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.params.id, req.user!.userId, tipo, cantidad, stockAnterior, stockNuevo, motivo ?? null]
    )
    await client.query('COMMIT')
    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'inventario',
      accion: `movimiento_${tipo}`,
      entidad: 'insumos',
      entidadId: req.params.id,
      detalle: { cantidad, stockAnterior, stockNuevo, motivo },
    })
    res.json(insumoRes.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: 'Error al registrar movimiento de inventario' })
  } finally {
    client.release()
  }
})

// PATCH /api/inventario/:id
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const { nombre, categoria, unidad, stock_actual, stock_minimo, proveedor, fecha_vencimiento, precio_unitario } = req.body

  try {
    const actual = await queryOne<{
      stock_actual: number
      stock_minimo: number
      fecha_vencimiento: string | null
    }>('SELECT stock_actual, stock_minimo, fecha_vencimiento FROM insumos WHERE id = $1', [req.params.id])
    if (!actual) { res.status(404).json({ error: 'Insumo no encontrado' }); return }

    // Recalcular el estado a partir de los valores resultantes (no solo los enviados).
    const sa = stock_actual ?? actual.stock_actual
    const sm = stock_minimo ?? actual.stock_minimo
    const fv = fecha_vencimiento ?? actual.fecha_vencimiento

    const estado = calcularEstado(sa, sm, fv)

    const insumo = await queryOne(
      `UPDATE insumos SET
        nombre = COALESCE($1, nombre),
        categoria = COALESCE($2, categoria),
        unidad = COALESCE($3, unidad),
        stock_actual = COALESCE($4, stock_actual),
        stock_minimo = COALESCE($5, stock_minimo),
        proveedor = COALESCE($6, proveedor),
        fecha_vencimiento = COALESCE($7, fecha_vencimiento),
        precio_unitario = COALESCE($8, precio_unitario),
        estado = $9,
        updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [nombre, categoria, unidad, stock_actual, stock_minimo, proveedor, fecha_vencimiento, precio_unitario, estado, req.params.id]
    )
    if (stock_actual !== undefined && stock_actual !== actual.stock_actual) {
      await query(
        `INSERT INTO inventario_movimientos
         (insumo_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo)
         VALUES ($1,$2,'ajuste',$3,$4,$5,$6)`,
        [req.params.id, req.user!.userId, Math.abs(Number(stock_actual) - Number(actual.stock_actual)), actual.stock_actual, stock_actual, 'Ajuste manual']
      )
    }
    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'inventario',
      accion: 'actualizar_insumo',
      entidad: 'insumos',
      entidadId: req.params.id,
      detalle: req.body,
    })
    res.json(insumo)
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar insumo' })
  }
})

// DELETE /api/inventario/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const eliminado = await queryOne('DELETE FROM insumos WHERE id = $1 RETURNING id', [req.params.id])
    if (!eliminado) { res.status(404).json({ error: 'Insumo no encontrado' }); return }
    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'inventario',
      accion: 'eliminar_insumo',
      entidad: 'insumos',
      entidadId: req.params.id,
    })
    res.json({ message: 'Insumo eliminado' })
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar insumo' })
  }
})

export default router
