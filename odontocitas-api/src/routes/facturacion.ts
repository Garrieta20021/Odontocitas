import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { query, queryOne } from '../db/pool'
import { authenticate, authorize } from '../middleware/auth'
import { registrarAuditoria } from '../services/auditoria'
import { crearSoporteFiscal } from '../services/facturacion'
import type { Request, Response } from 'express'

const router = Router()
router.use(authenticate, authorize('admin'))

// ─── GET /api/facturas ────────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { estado, cita_id, limit = 50, offset = 0 } = req.query
    let sql = `
      SELECT
        f.*, u.nombre AS paciente_nombre, u.cedula AS paciente_cedula,
        t.nombre AS tratamiento_nombre
      FROM facturas f
      JOIN pacientes p ON f.paciente_id = p.id
      JOIN usuarios u ON p.usuario_id = u.id
      LEFT JOIN citas c ON f.cita_id = c.id
      LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
      WHERE 1=1
    `
    const params: unknown[] = []
    let i = 1

    if (estado) { sql += ` AND f.estado = $${i++}`; params.push(estado) }
    if (cita_id) { sql += ` AND f.cita_id = $${i++}`; params.push(cita_id) }
    sql += ` ORDER BY f.fecha_emision DESC LIMIT $${i++} OFFSET $${i++}`
    params.push(limit, offset)

    const facturas = await query(sql, params)
    res.json(facturas)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener facturas' })
  }
})

// ─── GET /api/facturas/resumen ────────────────────────────────────
router.get('/resumen', async (_req: Request, res: Response): Promise<void> => {
  try {
    const resumen = await queryOne(`
      SELECT
        COALESCE(SUM(CASE WHEN estado = 'pagada' THEN total ELSE 0 END), 0) AS ingresos_mes,
        COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN total ELSE 0 END), 0) AS pendiente_cobro,
        COUNT(*)::int AS total_facturas,
        COALESCE(SUM(CASE WHEN estado = 'vencida' THEN total ELSE 0 END), 0) AS cartera_vencida
      FROM facturas
      WHERE DATE_TRUNC('month', fecha_emision) = DATE_TRUNC('month', CURRENT_DATE)
    `)
    res.json(resumen)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener resumen' })
  }
})

// ─── GET /api/facturas/:id ────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const factura = await queryOne(`
      SELECT f.*, u.nombre AS paciente_nombre, u.cedula AS paciente_cedula,
             t.nombre AS tratamiento_nombre
      FROM facturas f
      JOIN pacientes p ON f.paciente_id = p.id
      JOIN usuarios u ON p.usuario_id = u.id
      LEFT JOIN citas c ON f.cita_id = c.id
      LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
      WHERE f.id = $1
    `, [req.params.id])
    if (!factura) { res.status(404).json({ error: 'Factura no encontrada' }); return }
    res.json(factura)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener factura' })
  }
})

// ─── POST /api/facturas ───────────────────────────────────────────
router.post('/', [
  body('cita_id').notEmpty(),
  body('paciente_id').notEmpty(),
  body('total').isNumeric(),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

  const { cita_id, paciente_id, subtotal, descuento = 0, total, notas, metodo_pago, referencia_pago } = req.body

  try {
    // Numeración consecutiva por año, atómica (evita duplicados y huecos por borrado).
    const anio = new Date().getFullYear()
    const seq = await queryOne<{ ultimo: number }>(
      `INSERT INTO factura_secuencia (anio, ultimo) VALUES ($1, 1)
       ON CONFLICT (anio) DO UPDATE SET ultimo = factura_secuencia.ultimo + 1
       RETURNING ultimo`,
      [anio]
    )
    const num = `FAC-${anio}-${String(seq?.ultimo ?? 1).padStart(3, '0')}`
    const soporte = crearSoporteFiscal(num, total)

    const factura = await queryOne(
      `INSERT INTO facturas
       (numero, cita_id, paciente_id, subtotal, descuento, total, notas, metodo_pago, referencia_pago, cufe, qr_data, resolucion_dian)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [num, cita_id, paciente_id, subtotal, descuento, total, notas, metodo_pago, referencia_pago, soporte.cufe, soporte.qrData, soporte.resolucionDian]
    )
    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'facturacion',
      accion: 'crear_factura',
      entidad: 'facturas',
      entidadId: (factura as { id?: string } | null)?.id ?? null,
      detalle: { numero: num, total, paciente_id, cita_id },
    })
    res.status(201).json(factura)
  } catch (err) {
    res.status(500).json({ error: 'Error al crear factura' })
  }
})

// ─── PATCH /api/facturas/:id/pagar ───────────────────────────────
router.patch('/:id/pagar', async (req: Request, res: Response): Promise<void> => {
  const { metodo_pago, referencia_pago } = req.body ?? {}
  try {
    const factura = await queryOne(
      `UPDATE facturas
       SET estado = 'pagada',
           fecha_pago = NOW(),
           metodo_pago = COALESCE($2, metodo_pago),
           referencia_pago = COALESCE($3, referencia_pago)
       WHERE id = $1 RETURNING *`,
      [req.params.id, metodo_pago, referencia_pago]
    )
    if (!factura) { res.status(404).json({ error: 'Factura no encontrada' }); return }
    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'facturacion',
      accion: 'marcar_pagada',
      entidad: 'facturas',
      entidadId: req.params.id,
      detalle: { metodo_pago, referencia_pago },
    })
    res.json(factura)
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar pago' })
  }
})

export default router
