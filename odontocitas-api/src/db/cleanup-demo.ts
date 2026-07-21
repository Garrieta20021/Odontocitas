import { pool } from './pool'
import dotenv from 'dotenv'

dotenv.config()

const DEMO_CEDULAS = [
  '1023456789',
  '2034567890',
  '2045678901',
  '2056789012',
  '3045678901',
  '3056789012',
  '3067890123',
  '3078901234',
  '3089012345',
]

const DEMO_INSUMOS = [
  'Guantes de látex M',
  'Composite A2 (jeringa)',
  'Anestesia local Lidocaína',
  'Ácido grabador 37%',
  'Mascarillas N95',
  'Cepillos interproximales',
]

async function deleteCitasByIds(client: Awaited<ReturnType<typeof pool.connect>>, ids: string[]) {
  if (!ids.length) return 0
  await client.query(`DELETE FROM historia_clinica WHERE cita_id = ANY($1::uuid[])`, [ids])
  await client.query(`DELETE FROM facturas WHERE cita_id = ANY($1::uuid[])`, [ids])
  await client.query(`DELETE FROM notificaciones WHERE cita_id = ANY($1::uuid[])`, [ids])
  const res = await client.query(`DELETE FROM citas WHERE id = ANY($1::uuid[])`, [ids])
  return res.rowCount ?? 0
}

async function cleanupDemo() {
  const client = await pool.connect()
  try {
    console.log('🧹 Eliminando datos de prueba...')
    await client.query('BEGIN')

    const demoUsuarios = await client.query<{ id: string }>(
      `SELECT id FROM usuarios WHERE cedula = ANY($1::text[])`,
      [DEMO_CEDULAS]
    )
    const demoUsuarioIds = demoUsuarios.rows.map(r => r.id)

    const demoPacientes = demoUsuarioIds.length
      ? await client.query<{ id: string }>(
          `SELECT id FROM pacientes WHERE usuario_id = ANY($1::uuid[])`,
          [demoUsuarioIds]
        )
      : { rows: [] as { id: string }[] }
    const demoPacienteIds = demoPacientes.rows.map(r => r.id)

    // 1) Citas marcadas [demo] (incluye las de pacientes reales mezcladas en el seed)
    const citasDemo = await client.query<{ id: string }>(
      `SELECT id FROM citas WHERE motivo LIKE '[demo]%'`
    )
    const citasDemoEliminadas = await deleteCitasByIds(client, citasDemo.rows.map(r => r.id))

    // 2) Resto de citas de pacientes demo
    let citasPacienteDemo = 0
    if (demoPacienteIds.length) {
      const restantes = await client.query<{ id: string }>(
        `SELECT id FROM citas WHERE paciente_id = ANY($1::uuid[])`,
        [demoPacienteIds]
      )
      citasPacienteDemo = await deleteCitasByIds(client, restantes.rows.map(r => r.id))

      await client.query(`DELETE FROM historia_clinica WHERE paciente_id = ANY($1::uuid[])`, [demoPacienteIds])
      await client.query(`DELETE FROM odontograma WHERE paciente_id = ANY($1::uuid[])`, [demoPacienteIds])
      await client.query(`DELETE FROM facturas WHERE paciente_id = ANY($1::uuid[])`, [demoPacienteIds])
    }

    // 3) Usuarios demo sin citas activas que los referencien
    if (demoUsuarioIds.length) {
      await client.query(`DELETE FROM notificaciones WHERE usuario_id = ANY($1::uuid[])`, [demoUsuarioIds])
      await client.query(`DELETE FROM auditoria WHERE usuario_id = ANY($1::uuid[])`, [demoUsuarioIds])

      // Pacientes demo (cascade si no quedan citas)
      await client.query(
        `DELETE FROM pacientes WHERE usuario_id = ANY($1::uuid[])`,
        [demoUsuarioIds]
      )

      // Odontólogos/admin demo solo si ya no tienen citas
      await client.query(
        `DELETE FROM odontologos o
         USING usuarios u
         WHERE o.usuario_id = u.id
           AND u.cedula = ANY($1::text[])
           AND NOT EXISTS (SELECT 1 FROM citas c WHERE c.odontologo_id = o.id)`,
        [DEMO_CEDULAS]
      )

      await client.query(
        `DELETE FROM usuarios u
         WHERE u.cedula = ANY($1::text[])
           AND NOT EXISTS (SELECT 1 FROM odontologos o WHERE o.usuario_id = u.id AND EXISTS (
             SELECT 1 FROM citas c WHERE c.odontologo_id = o.id
           ))`,
        [DEMO_CEDULAS]
      )
    }

    const delInsumosMov = await client.query(
      `DELETE FROM inventario_movimientos
       WHERE insumo_id IN (SELECT id FROM insumos WHERE nombre = ANY($1::text[]))`,
      [DEMO_INSUMOS]
    )
    const delInsumos = await client.query(
      `DELETE FROM insumos WHERE nombre = ANY($1::text[])`,
      [DEMO_INSUMOS]
    )

    await client.query('DELETE FROM whatsapp_conversaciones')
    await client.query('DELETE FROM whatsapp_mensajes_procesados')
    await client.query('DELETE FROM whatsapp_eventos')

    await client.query('COMMIT')

    const resumen = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM usuarios) AS usuarios,
        (SELECT COUNT(*)::int FROM citas) AS citas,
        (SELECT COUNT(*)::int FROM facturas) AS facturas,
        (SELECT COUNT(*)::int FROM insumos) AS insumos,
        (SELECT COUNT(*)::int FROM pacientes) AS pacientes
    `)

    console.log('✅ Limpieza completada')
    console.log(`   Citas [demo] eliminadas: ${citasDemoEliminadas}`)
    console.log(`   Citas de pacientes demo: ${citasPacienteDemo}`)
    console.log(`   Insumos demo eliminados: ${delInsumos.rowCount ?? 0}`)
    console.log(`   Movimientos inventario: ${delInsumosMov.rowCount ?? 0}`)
    console.log('\n📊 Estado actual:', resumen.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Error en limpieza:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

cleanupDemo()
