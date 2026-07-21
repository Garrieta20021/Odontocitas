import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { queryOne } from '../db/pool'
import { authenticate, authorize } from '../middleware/auth'
import type { Request, Response } from 'express'

const router = Router()

router.use(authenticate)

const defaultConfig = {
  id: true,
  nombre_clinica: 'Clinica Sonrisas',
  nit: '900.123.456-7',
  telefono: '605 345 6789',
  email: 'info@clinicasonrisas.co',
  direccion: 'Cra 54 #72-33, Barranquilla',
  ciudad: 'Barranquilla, Atlantico',
  horarios: [
    { dia: 'Lunes a Viernes', desde: '08:00', hasta: '18:00', activo: true },
    { dia: 'Sabados', desde: '08:00', hasta: '13:00', activo: true },
    { dia: 'Domingos', desde: '', hasta: '', activo: false },
  ],
}

const defaultNotificaciones = {
  recordatorios_activos: true,
  horas_anticipacion: 24,
  canal_email: true,
  canal_sms: false,
  canal_whatsapp: false,
  resumen_diario: true,
}

const defaultIntegraciones = {
  email_remitente: '',
  smtp_host: '',
  whatsapp_numero: '',
  pasarela_pago: 'ninguna',
}

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    let config = await queryOne('SELECT * FROM configuracion_general WHERE id = true')

    if (!config) {
      config = await queryOne(
        `INSERT INTO configuracion_general
         (id, nombre_clinica, nit, telefono, email, direccion, ciudad, horarios)
         VALUES (true, $1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          defaultConfig.nombre_clinica,
          defaultConfig.nit,
          defaultConfig.telefono,
          defaultConfig.email,
          defaultConfig.direccion,
          defaultConfig.ciudad,
          JSON.stringify(defaultConfig.horarios),
        ]
      )
    }

    res.json(config)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener configuracion' })
  }
})

router.put('/', authorize('admin'), [
  body('nombre_clinica').notEmpty().withMessage('Nombre de clinica requerido'),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email invalido'),
  body('horarios').optional().isArray().withMessage('Horarios debe ser una lista'),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() })
    return
  }

  const {
    nombre_clinica,
    nit,
    telefono,
    email,
    direccion,
    ciudad,
    horarios,
    notificaciones,
    integraciones,
  } = req.body

  try {
    const config = await queryOne(
      `INSERT INTO configuracion_general
       (id, nombre_clinica, nit, telefono, email, direccion, ciudad, horarios, notificaciones, integraciones, updated_at)
       VALUES (true, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (id) DO UPDATE SET
         nombre_clinica = EXCLUDED.nombre_clinica,
         nit = EXCLUDED.nit,
         telefono = EXCLUDED.telefono,
         email = EXCLUDED.email,
         direccion = EXCLUDED.direccion,
         ciudad = EXCLUDED.ciudad,
         horarios = EXCLUDED.horarios,
         notificaciones = EXCLUDED.notificaciones,
         integraciones = EXCLUDED.integraciones,
         updated_at = NOW()
       RETURNING *`,
      [
        nombre_clinica,
        nit ?? null,
        telefono ?? null,
        email ?? null,
        direccion ?? null,
        ciudad ?? null,
        JSON.stringify(horarios ?? []),
        JSON.stringify({ ...defaultNotificaciones, ...(notificaciones ?? {}) }),
        JSON.stringify({ ...defaultIntegraciones, ...(integraciones ?? {}) }),
      ]
    )

    res.json(config)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar configuracion' })
  }
})

export default router
