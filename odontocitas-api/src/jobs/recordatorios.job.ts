import cron from 'node-cron'
import { citasDeManiana, formatearTelefonoWhatsapp } from '../services/citas.service'
import { enviarMensajeWhatsApp } from '../services/whatsapp.service'
import { guardarContextoWhatsapp } from '../services/whatsapp-conversation.service'

function formatearHora(fecha: string): string {
  // Las citas se guardan como hora de pared en UTC, por eso se formatea en UTC.
  return new Date(fecha).toLocaleString('es-CO', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'UTC',
  })
}

// Envía recordatorios interactivos por WhatsApp de las citas de mañana y deja
// el contexto listo para que el paciente confirme, reprograme o cancele
// respondiendo 1, 2 o 3.
export async function enviarRecordatoriosManiana(): Promise<void> {
  const citas = await citasDeManiana()
  console.log(`[recordatorios] ${citas.length} cita(s) para mañana.`)

  for (const cita of citas) {
    const numero = formatearTelefonoWhatsapp(cita.paciente_telefono)
    if (!numero) continue

    const mensaje =
      `Hola ${cita.paciente_nombre.split(' ')[0]} 👋\n\n` +
      `Te recordamos tu cita ${cita.tratamiento_nombre ? `de ${cita.tratamiento_nombre} ` : ''}` +
      `con ${cita.odontologo_nombre} el ${formatearHora(cita.fecha_hora)}.\n\n` +
      `Por favor responde:\n` +
      `1️⃣ Confirmar\n` +
      `2️⃣ Reprogramar\n` +
      `3️⃣ Cancelar`

    try {
      await enviarMensajeWhatsApp(numero, mensaje)
      // Dejamos el contexto a la espera de la respuesta 1/2/3 del paciente.
      await guardarContextoWhatsapp(numero, {
        pendiente: true,
        ultima_accion: 'confirmar_asistencia',
        cita_id: cita.id,
      })
    } catch (err) {
      console.error(`[recordatorios] No se pudo enviar a ${numero}:`, err)
    }
  }
}

// Programa el envío diario de recordatorios a las 8:00 AM (hora Colombia).
export function iniciarRecordatorios(): void {
  cron.schedule(
    '0 8 * * *',
    () => {
      enviarRecordatoriosManiana().catch(err =>
        console.error('[recordatorios] Error en la tarea programada:', err)
      )
    },
    { timezone: 'America/Bogota' }
  )
  console.log('⏰ Recordatorios automáticos programados (8:00 AM, citas de mañana)')
}
