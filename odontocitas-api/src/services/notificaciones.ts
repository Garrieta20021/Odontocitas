import { query } from '../db/pool'

interface CrearNotificacionParams {
  usuarioId: string
  citaId?: string | null
  tipo: string
  titulo: string
  mensaje: string
  canal?: string
}

export async function crearNotificacion(params: CrearNotificacionParams): Promise<void> {
  await query(
    `INSERT INTO notificaciones (usuario_id, cita_id, tipo, titulo, mensaje, canal, enviado_en)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      params.usuarioId,
      params.citaId ?? null,
      params.tipo,
      params.titulo,
      params.mensaje,
      params.canal ?? 'sistema',
    ]
  )

  // Preparación de canales externos. Sin credenciales reales SMTP/WhatsApp,
  // se deja trazabilidad en notificaciones para saber qué se debería enviar.
  if ((params.canal ?? 'sistema') === 'sistema') {
    const config = await query<{
      notificaciones: { canal_email?: boolean; canal_whatsapp?: boolean }
      integraciones: { smtp_host?: string; whatsapp_numero?: string }
    }>(`SELECT notificaciones, integraciones FROM configuracion_general WHERE id = true`)
    const canales = config[0]
    const externos: string[] = []
    if (canales?.notificaciones?.canal_email) externos.push('email')
    if (canales?.notificaciones?.canal_whatsapp) externos.push('whatsapp')

    for (const canal of externos) {
      const configurado = canal === 'email'
        ? Boolean(canales.integraciones?.smtp_host)
        : Boolean(canales.integraciones?.whatsapp_numero)
      await query(
        `INSERT INTO notificaciones (usuario_id, cita_id, tipo, titulo, mensaje, canal, enviado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          params.usuarioId,
          params.citaId ?? null,
          `${params.tipo}_${canal}`,
          `${params.titulo} (${canal})`,
          configurado
            ? params.mensaje
            : `${params.mensaje} [Pendiente de configurar integración real de ${canal}.]`,
          canal,
          configurado ? new Date() : null,
        ]
      )
    }
  }
}

function formatearFecha(fecha: string | Date): string {
  return new Date(fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
}

// Avisa a todos los administradores activos de una nueva solicitud de cita
// para que puedan aceptarla o rechazarla.
export async function notificarSolicitudCitaAAdmins(citaId: string): Promise<void> {
  const info = await query<{ paciente_nombre: string; fecha_hora: string }>(
    `SELECT up.nombre AS paciente_nombre, c.fecha_hora
     FROM citas c
     JOIN pacientes p ON c.paciente_id = p.id
     JOIN usuarios up ON p.usuario_id = up.id
     WHERE c.id = $1`,
    [citaId]
  )
  if (info.length === 0) return

  const { paciente_nombre, fecha_hora } = info[0]
  const fecha = formatearFecha(fecha_hora)

  const admins = await query<{ id: string }>(
    `SELECT id FROM usuarios WHERE rol = 'admin' AND activo = true`
  )

  for (const admin of admins) {
    await crearNotificacion({
      usuarioId: admin.id,
      citaId,
      tipo: 'solicitud',
      titulo: 'Nueva solicitud de cita',
      mensaje: `${paciente_nombre} solicitó una cita para el ${fecha}. Revisa la petición y confírmala o recházala.`,
    })
  }
}

// Avisa a los administradores que un paciente solicitó reprogramar su cita,
// para que aprueben (confirmar) o rechacen (cancelar) la nueva fecha.
export async function notificarReprogramacionCitaAAdmins(citaId: string): Promise<void> {
  const info = await query<{ paciente_nombre: string; fecha_hora: string }>(
    `SELECT up.nombre AS paciente_nombre, c.fecha_hora
     FROM citas c
     JOIN pacientes p ON c.paciente_id = p.id
     JOIN usuarios up ON p.usuario_id = up.id
     WHERE c.id = $1`,
    [citaId]
  )
  if (info.length === 0) return

  const { paciente_nombre, fecha_hora } = info[0]
  const fecha = formatearFecha(fecha_hora)

  const admins = await query<{ id: string }>(
    `SELECT id FROM usuarios WHERE rol = 'admin' AND activo = true`
  )

  for (const admin of admins) {
    await crearNotificacion({
      usuarioId: admin.id,
      citaId,
      tipo: 'solicitud',
      titulo: 'Solicitud de reprogramación',
      mensaje: `${paciente_nombre} solicitó reprogramar su cita para el ${fecha}. Revisa la nueva fecha y confírmala o recházala.`,
    })
  }
}

// Avisa al paciente cuando el administrador acepta o rechaza su solicitud.
export async function notificarRespuestaCitaAlPaciente(citaId: string, estado: string): Promise<void> {
  const info = await query<{ usuario_id: string; fecha_hora: string }>(
    `SELECT up.id AS usuario_id, c.fecha_hora
     FROM citas c
     JOIN pacientes p ON c.paciente_id = p.id
     JOIN usuarios up ON p.usuario_id = up.id
     WHERE c.id = $1`,
    [citaId]
  )
  if (info.length === 0) return

  const { usuario_id, fecha_hora } = info[0]
  const fecha = formatearFecha(fecha_hora)

  if (estado === 'confirmada') {
    await crearNotificacion({
      usuarioId: usuario_id,
      citaId,
      tipo: 'confirmacion',
      titulo: 'Cita confirmada',
      mensaje: `Tu cita del ${fecha} fue confirmada por la clínica.`,
    })
  } else if (estado === 'cancelada') {
    await crearNotificacion({
      usuarioId: usuario_id,
      citaId,
      tipo: 'cancelacion',
      titulo: 'Solicitud rechazada',
      mensaje: `Tu solicitud de cita del ${fecha} fue rechazada. Puedes solicitar una nueva fecha.`,
    })
  }
}
