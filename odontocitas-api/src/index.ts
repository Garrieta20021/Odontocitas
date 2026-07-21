import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import authRouter from './routes/auth'
import citasRouter from './routes/citas'
import pacientesRouter from './routes/pacientes'
import facturacionRouter from './routes/facturacion'
import inventarioRouter from './routes/inventario'
import dashboardRouter from './routes/dashboard'
import odontologosRouter from './routes/odontologos'
import tratamientosRouter from './routes/tratamientos'
import notificacionesRouter from './routes/notificaciones'
import configuracionRouter from './routes/configuracion'
import usuariosRouter from './routes/usuarios'
import auditoriaRouter from './routes/auditoria'
import whatsappRoutes from './routes/whatsapp.routes'
import { errorHandler } from './middleware/errorHandler'
import { iniciarRecordatorios } from './jobs/recordatorios.job'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// ── Middlewares ──────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Healthcheck ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Rutas API ────────────────────────────────────────────────────
app.use('/api/auth', authRouter)
app.use('/api/citas', citasRouter)
app.use('/api/pacientes', pacientesRouter)
app.use('/api/facturas', facturacionRouter)
app.use('/api/inventario', inventarioRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/odontologos', odontologosRouter)
app.use('/api/tratamientos', tratamientosRouter)
app.use('/api/notificaciones', notificacionesRouter)
app.use('/api/configuracion', configuracionRouter)
app.use('/api/usuarios', usuariosRouter)
app.use('/api/auditoria', auditoriaRouter)
app.use('/api/whatsapp', whatsappRoutes)

// ── 404 ──────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' })
})

// ── Error handler ────────────────────────────────────────────────
app.use(errorHandler)

// ── Iniciar servidor ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🦷 Odontocitas API corriendo en http://localhost:${PORT}`)
  console.log(`📋 Endpoints disponibles:`)
  console.log(`   POST   /api/auth/login`)
  console.log(`   GET    /api/dashboard/metricas`)
  console.log(`   GET    /api/citas`)
  console.log(`   GET    /api/pacientes`)
  console.log(`   GET    /api/facturas`)
  console.log(`   GET    /api/inventario`)
  console.log(`   GET    /api/odontologos`)
  console.log(`   GET    /api/tratamientos\n`)
  console.log(`   GET    /api/configuracion\n`)
  iniciarRecordatorios()
})

export default app
