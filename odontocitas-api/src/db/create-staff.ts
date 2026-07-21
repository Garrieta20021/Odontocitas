import bcrypt from 'bcryptjs'
import { pool } from './pool'
import dotenv from 'dotenv'

dotenv.config()

const PASSWORD = '123456'

const STAFF = [
  {
    cedula: '1023456789',
    nombre: 'Ana García',
    email: 'admin@clinicasonrisas.co',
    telefono: '3001234567',
    rol: 'admin' as const,
  },
  {
    cedula: '2034567890',
    nombre: 'Dra. García',
    email: 'dra.garcia@clinicasonrisas.co',
    telefono: '3007654321',
    rol: 'odontologo' as const,
    especialidad: 'general',
    registro_profesional: 'PRO-20345',
    color: '#C17A5A',
  },
]

async function createStaff() {
  const client = await pool.connect()
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  try {
    await client.query('BEGIN')

    for (const person of STAFF) {
      const usuarioRes = await client.query<{ id: string }>(
        `INSERT INTO usuarios (cedula, nombre, email, telefono, password_hash, rol)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (cedula) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           email = EXCLUDED.email,
           telefono = EXCLUDED.telefono,
           password_hash = EXCLUDED.password_hash,
           rol = EXCLUDED.rol,
           activo = true
         RETURNING id`,
        [person.cedula, person.nombre, person.email, person.telefono, passwordHash, person.rol]
      )
      const usuarioId = usuarioRes.rows[0].id

      if (person.rol === 'odontologo') {
        await client.query(
          `INSERT INTO odontologos (usuario_id, especialidad, registro_profesional, color)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (usuario_id) DO UPDATE SET
             especialidad = EXCLUDED.especialidad,
             registro_profesional = EXCLUDED.registro_profesional,
             color = EXCLUDED.color`,
          [usuarioId, person.especialidad, person.registro_profesional, person.color]
        )
      }

      console.log(`✅ ${person.rol}: ${person.nombre} (cédula ${person.cedula})`)
    }

    await client.query('COMMIT')
    console.log(`\n📋 Contraseña inicial para ambos: ${PASSWORD}`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Error:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

createStaff()
