import { pool } from './pool'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Seed mínimo: solo catálogo de tratamientos (necesario para agendar citas).
 * No crea usuarios, citas, insumos ni odontograma de prueba.
 */
async function seed() {
  const client = await pool.connect()
  try {
    console.log('🌱 Verificando catálogo de tratamientos...')
    await client.query('BEGIN')

    await client.query(`
      INSERT INTO tratamientos (nombre, descripcion, duracion_minutos, tarifa, especialidad)
      VALUES
        ('Limpieza dental', 'Detartraje y pulido coronal', 45, 180000, 'general'),
        ('Blanqueamiento', 'Blanqueamiento dental profesional', 90, 450000, 'blanqueamiento'),
        ('Extracción simple', 'Extracción dental simple', 30, 120000, 'general'),
        ('Endodoncia', 'Tratamiento de conductos radiculares', 120, 620000, 'endodoncia'),
        ('Ortodoncia consulta', 'Consulta y ajuste de ortodoncia', 60, 350000, 'ortodoncia'),
        ('Consulta general', 'Consulta y diagnóstico general', 30, 80000, 'general')
      ON CONFLICT (nombre) DO NOTHING
    `)

    await client.query('COMMIT')
    console.log('✅ Catálogo de tratamientos listo (sin datos de prueba de usuarios/citas).')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Error en seed:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
