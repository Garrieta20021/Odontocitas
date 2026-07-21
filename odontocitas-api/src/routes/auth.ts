import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { body, validationResult } from 'express-validator'
import { queryOne } from '../db/pool'
import { authenticate } from '../middleware/auth'
import { getJwtSecret } from '../config/jwt'
import type { Request, Response } from 'express'

const router = Router()
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'

interface UsuarioRow {
  id: string
  cedula: string
  nombre: string
  email: string
  telefono: string
  password_hash: string
  rol: string
  activo: boolean
}

// POST /api/auth/login
router.post('/login', [
  body('cedula').notEmpty().withMessage('Cédula requerida'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
  body('rol').isIn(['admin', 'odontologo', 'paciente']).withMessage('Rol inválido'),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() })
    return
  }

  const { cedula, password, rol } = req.body

  // Normalizar cédula (quitar puntos y espacios)
  const cedulaNorm = String(cedula).replace(/[\.\s]/g, '')

  try {
    const usuario = await queryOne<UsuarioRow>(
      'SELECT * FROM usuarios WHERE cedula = $1 AND rol = $2 AND activo = true',
      [cedulaNorm, rol]
    )

    if (!usuario) {
      res.status(401).json({ error: 'Credenciales incorrectas' })
      return
    }

    const passwordOk = await bcrypt.compare(password, usuario.password_hash)
    if (!passwordOk) {
      res.status(401).json({ error: 'Credenciales incorrectas' })
      return
    }

    const payload = {
      userId: usuario.id,
      cedula: usuario.cedula,
      rol: usuario.rol,
      nombre: usuario.nombre,
    }

    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions)

    // Si es odontólogo o paciente, obtener su ID de perfil
    let perfilId: string | null = null
    if (rol === 'odontologo') {
      const od = await queryOne<{ id: string }>(
        'SELECT id FROM odontologos WHERE usuario_id = $1', [usuario.id]
      )
      perfilId = od?.id ?? null
    } else if (rol === 'paciente') {
      const pac = await queryOne<{ id: string }>(
        'SELECT id FROM pacientes WHERE usuario_id = $1', [usuario.id]
      )
      perfilId = pac?.id ?? null
    }

    res.json({
      token,
      user: {
        id: usuario.id,
        perfilId,
        cedula: usuario.cedula,
        nombre: usuario.nombre,
        email: usuario.email,
        telefono: usuario.telefono,
        rol: usuario.rol,
        initials: usuario.nombre.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
      }
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario = await queryOne<UsuarioRow>(
      'SELECT id, cedula, nombre, email, telefono, rol FROM usuarios WHERE id = $1',
      [req.user!.userId]
    )
    if (!usuario) {
      res.status(404).json({ error: 'Usuario no encontrado' })
      return
    }
    res.json(usuario)
  } catch (err) {
    res.status(500).json({ error: 'Error interno' })
  }
})

export default router
