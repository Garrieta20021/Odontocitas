import { query, queryOne } from '../db/pool'
import { createHash } from 'crypto'

export function crearSoporteFiscal(numero: string, total: number | string) {
  const base = `${numero}|${total}|${new Date().toISOString()}`
  const cufe = createHash('sha256').update(base).digest('hex')
  return {
    cufe,
    qrData: `Factura ${numero} | Total ${total} | CUFE ${cufe}`,
    resolucionDian: 'Pendiente integración DIAN',
  }
}

// Genera la factura de una cita (estado 'pendiente') usando la tarifa del
// tratamiento. Es idempotente: si la cita ya tiene factura, no hace nada.
// Si la cita no tiene tratamiento con tarifa, no genera factura.
export async function generarFacturaParaCita(citaId: string): Promise<string | null> {
  const existente = await queryOne<{ id: string }>(
    'SELECT id FROM facturas WHERE cita_id = $1',
    [citaId]
  )
  if (existente) return null

  const cita = await queryOne<{ paciente_id: string; tarifa: string | null }>(`
    SELECT c.paciente_id, t.tarifa
    FROM citas c
    LEFT JOIN tratamientos t ON c.tratamiento_id = t.id
    WHERE c.id = $1
  `, [citaId])
  if (!cita) return null

  const tarifa = Number(cita.tarifa ?? 0)
  if (!tarifa || tarifa <= 0) return null

  const anio = new Date().getFullYear()
  const seq = await queryOne<{ ultimo: number }>(
    `INSERT INTO factura_secuencia (anio, ultimo) VALUES ($1, 1)
     ON CONFLICT (anio) DO UPDATE SET ultimo = factura_secuencia.ultimo + 1
     RETURNING ultimo`,
    [anio]
  )
  const numero = `FAC-${anio}-${String(seq?.ultimo ?? 1).padStart(3, '0')}`
  const soporte = crearSoporteFiscal(numero, tarifa)

  await query(
    `INSERT INTO facturas
     (numero, cita_id, paciente_id, subtotal, descuento, total, estado, cufe, qr_data, resolucion_dian)
     VALUES ($1, $2, $3, $4, 0, $4, 'pendiente', $5, $6, $7)`,
    [numero, citaId, cita.paciente_id, tarifa, soporte.cufe, soporte.qrData, soporte.resolucionDian]
  )

  return numero
}
