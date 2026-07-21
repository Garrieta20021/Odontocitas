import { Router } from 'express'
import {
  buscarPacientePorTelefono,
  cancelarCita,
  consultarCita,
  consultarDisponibilidad,
  crearCita,
  reprogramarCita,
} from '../services/chatbot.service'
import {
  cancelarCitaPorId,
  confirmarAsistenciaCita,
  rechazarEspacioListaEspera,
  tomarEspacioListaEspera,
} from '../services/citas.service'
import { interpretarMensaje, transcribirAudio } from '../services/gemini.service'
import { descargarMediaWhatsApp } from '../services/whatsapp-media.service'
import { interpretarMensajeFallback } from '../services/fallback-intent.service'
import { buscarUsuarioAdminPorTelefono, procesarMensajeAdminWhatsapp } from '../services/admin-whatsapp.service'
import {
  limpiarContextoWhatsapp,
  limpiarMensajesWhatsappAntiguos,
  marcarMensajeWhatsappProcesado,
  obtenerContextoWhatsapp,
  guardarContextoWhatsapp,
  unirAcciones,
  type AccionChatbot,
} from '../services/whatsapp-conversation.service'
import { enviarMensajeWhatsApp } from '../services/whatsapp.service'
import { registrarEventoWhatsapp } from '../services/whatsapp-eventos.service'
import type { Request, Response } from 'express'

const router = Router()

function limpiarJsonGemini(texto: string): string {
  return texto
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function parsearAccionGemini(texto: string | undefined): AccionChatbot {
  try {
    return JSON.parse(limpiarJsonGemini(texto ?? '{}')) as AccionChatbot
  } catch (err) {
    console.error('Gemini no devolvió JSON válido:', err, texto)
    return {}
  }
}

type MensajeEntrante = {
  id?: string
  from: string
  tipo: 'texto' | 'audio' | 'no_soportado'
  text?: string
  audioId?: string
}

function extraerMensajes(body: unknown): MensajeEntrante[] {
  const mensajes: MensajeEntrante[] = []
  const entry = (body as { entry?: unknown[] })?.entry ?? []

  for (const e of entry) {
    const changes = (e as { changes?: unknown[] })?.changes ?? []
    for (const c of changes) {
      const value = (c as { value?: { messages?: unknown[] } })?.value
      for (const m of value?.messages ?? []) {
        const msg = m as {
          id?: string
          from?: string
          text?: { body?: string }
          audio?: { id?: string }
          type?: string
        }
        if (!msg.from) continue

        if (msg.text?.body) {
          mensajes.push({ id: msg.id, from: msg.from, tipo: 'texto', text: msg.text.body })
        } else if (msg.type === 'audio' && msg.audio?.id) {
          mensajes.push({ id: msg.id, from: msg.from, tipo: 'audio', audioId: msg.audio.id })
        } else {
          mensajes.push({ id: msg.id, from: msg.from, tipo: 'no_soportado' })
        }
      }
    }
  }

  return mensajes
}

// Descarga y transcribe una nota de voz de WhatsApp usando Gemini.
async function transcribirNotaDeVoz(audioId: string): Promise<string | null> {
  try {
    const media = await descargarMediaWhatsApp(audioId)
    if (!media) return null
    const base64 = media.buffer.toString('base64')
    const mimeLimpio = media.mimeType.split(';')[0].trim()
    return await transcribirAudio(base64, mimeLimpio)
  } catch (err) {
    console.error('No se pudo transcribir la nota de voz:', err)
    return null
  }
}

// Orquesta cada mensaje entrante según su tipo (texto, audio o no soportado).
async function manejarMensajeEntrante(mensaje: MensajeEntrante): Promise<void> {
  if (mensaje.tipo === 'texto' && mensaje.text) {
    await procesarMensaje(mensaje.from, mensaje.text, mensaje.id)
    return
  }

  if (mensaje.tipo === 'audio' && mensaje.audioId) {
    // Deduplicamos antes de transcribir para no gastar cuota de Gemini en
    // reintentos del webhook de Meta.
    if (mensaje.id) {
      const nuevo = await marcarMensajeWhatsappProcesado(mensaje.id, mensaje.from)
      if (!nuevo) return
    }

    const texto = await transcribirNotaDeVoz(mensaje.audioId)
    if (!texto) {
      await responderWhatsAppSeguro(
        mensaje.from,
        'No pude entender tu nota de voz. ¿Puedes repetirla o escribir tu mensaje, por favor?'
      )
      return
    }

    // Confirmamos lo que entendimos: clave para fechas/horas de las citas.
    await responderWhatsAppSeguro(mensaje.from, `🎤 Entendí: "${texto}"`)
    // El mensaje ya fue deduplicado, así que no reenviamos el id.
    await procesarMensaje(mensaje.from, texto)
    return
  }

  if (mensaje.id) {
    const nuevo = await marcarMensajeWhatsappProcesado(mensaje.id, mensaje.from)
    if (!nuevo) return
  }
  await responderWhatsAppSeguro(
    mensaje.from,
    'Por ahora solo puedo leer texto o escuchar notas de voz. ¿Puedes escribirme o enviarme un audio?'
  )
}

async function responderWhatsAppSeguro(to: string, texto: string): Promise<void> {
  try {
    await enviarMensajeWhatsApp(to, texto)
  } catch (err) {
    console.error('No se pudo enviar respuesta por WhatsApp:', err)
  }
}

async function procesarMensaje(from: string, texto: string, mensajeId?: string): Promise<void> {
  try {
    if (mensajeId) {
      const nuevo = await marcarMensajeWhatsappProcesado(mensajeId, from)
      if (!nuevo) return
    }

    const usuarioAdmin = await buscarUsuarioAdminPorTelefono(from)
    if (usuarioAdmin) {
      await registrarEventoWhatsapp({
        telefono: from,
        rol: usuarioAdmin.rol,
        tipo: 'mensaje_entrante',
        detalle: { texto: texto.slice(0, 120) },
      })
      const resultadoAdmin = await procesarMensajeAdminWhatsapp(usuarioAdmin, texto, from)
      if (resultadoAdmin.atendido && resultadoAdmin.mensaje) {
        await responderWhatsAppSeguro(from, resultadoAdmin.mensaje)
        return
      }
    }

    const paciente = await buscarPacientePorTelefono(from)
    if (!paciente) {
      await registrarEventoWhatsapp({
        telefono: from,
        rol: 'desconocido',
        tipo: 'mensaje_entrante',
        detalle: { texto: texto.slice(0, 120) },
      })
      await enviarMensajeWhatsApp(
        from,
        'Hola. No encontré un paciente registrado con este número de WhatsApp. Comunícate con la clínica para actualizar tus datos.'
      )
      return
    }

    const primerNombre = paciente.nombre.split(' ')[0]
    const contexto = await obtenerContextoWhatsapp(from)

    await registrarEventoWhatsapp({
      telefono: from,
      rol: 'paciente',
      tipo: 'mensaje_entrante',
      detalle: { texto: texto.slice(0, 120), paciente_id: paciente.paciente_id },
    })

    // Si veníamos de un recordatorio esperando confirmación de asistencia,
    // interpretamos la respuesta 1/2/3 directamente (sin gastar cuota de Gemini).
    if (contexto?.ultima_accion === 'confirmar_asistencia' && contexto.cita_id) {
      const t = texto.trim().toLowerCase()
      const esCancelar = /(^|\b)3(\b|$)|cancel|anul|no\s+(puedo|podre|podré|voy|asist)/.test(t)
      const esReprogramar = /(^|\b)2(\b|$)|reprogram|reagend|cambiar|otra\s+(fecha|hora)|otro\s+dia|otro\s+día/.test(t)
      const esConfirmar = /(^|\b)1(\b|$)|confirm|^s[ií]$|\bvoy\b|asist|all[ií]\s+estar|ah[ií]\s+estar/.test(t)

      if (esCancelar) {
        const r = await cancelarCitaPorId(paciente, contexto.cita_id)
        await limpiarContextoWhatsapp(from)
        await responderWhatsAppSeguro(from, r.mensaje)
        return
      }
      if (esReprogramar) {
        await guardarContextoWhatsapp(from, {
          pendiente: true,
          ultima_accion: 'reprogramar_cita',
          datos: { accion: 'reprogramar_cita' },
        })
        await responderWhatsAppSeguro(
          from,
          `Claro, ${primerNombre}. ¿Para qué fecha y hora quieres reprogramar tu cita? (ej. 2026-06-20 09:00)`
        )
        return
      }
      if (esConfirmar) {
        const r = await confirmarAsistenciaCita(paciente, contexto.cita_id)
        await limpiarContextoWhatsapp(from)
        await responderWhatsAppSeguro(from, r.mensaje)
        return
      }

      await responderWhatsAppSeguro(
        from,
        `Por favor responde:\n1️⃣ Confirmar\n2️⃣ Reprogramar\n3️⃣ Cancelar`
      )
      return
    }

    // Respuesta a una oferta de lista de espera: 1 toma el espacio liberado,
    // 2 mantiene la cita original. Se procesa sin Gemini para evitar latencia/cuota.
    if (contexto?.ultima_accion === 'oferta_lista_espera' && contexto.cita_id && contexto.slot_cita_id) {
      const t = texto.trim().toLowerCase()
      const acepta = /(^|\b)1(\b|$)|\bsi\b|\bsí\b|acept|tomar|quiero|dale|listo|confirm/.test(t)
      const rechaza = /(^|\b)2(\b|$)|\bno\b|mantener|dejar|rechaz|no puedo/.test(t)

      if (acepta) {
        const r = await tomarEspacioListaEspera(paciente, contexto.cita_id, contexto.slot_cita_id)
        await limpiarContextoWhatsapp(from)
        await responderWhatsAppSeguro(from, r.mensaje)
        return
      }
      if (rechaza) {
        const r = await rechazarEspacioListaEspera(from)
        await responderWhatsAppSeguro(from, r.mensaje)
        return
      }

      await responderWhatsAppSeguro(from, `Por favor responde:\n1️⃣ Sí, tomar el espacio\n2️⃣ No, mantener mi cita`)
      return
    }

    // Respuesta a recomendación automática de control posterior a una cita.
    if (contexto?.ultima_accion === 'recomendacion_control' && contexto.datos?.fecha) {
      const t = texto.trim().toLowerCase()
      const acepta = /(^|\b)1(\b|$)|\bsi\b|\bsí\b|acept|quiero|dale|listo|program|agend|ver horarios/.test(t)
      const rechaza = /(^|\b)2(\b|$)|\bno\b|despues|después|luego|por ahora no|no por ahora/.test(t)

      if (rechaza) {
        await limpiarContextoWhatsapp(from)
        await responderWhatsAppSeguro(from, 'Perfecto, no programaré el control por ahora. Cuando lo necesites, escríbenos por aquí.')
        return
      }
      if (acepta) {
        const disp = await consultarDisponibilidad(contexto.datos.fecha, contexto.datos.especialidad ?? undefined)
        await guardarContextoWhatsapp(from, {
          pendiente: true,
          ultima_accion: 'crear_cita',
          datos: contexto.datos,
        })
        await responderWhatsAppSeguro(
          from,
          disp.ok
            ? `${disp.mensaje} Respóndeme con la hora que prefieras (ej. ${contexto.datos.fecha} 09:00) para programar tu control.`
            : disp.mensaje
        )
        return
      }

      await responderWhatsAppSeguro(from, `Por favor responde:\n1️⃣ Sí, ver horarios\n2️⃣ No por ahora`)
      return
    }

    // Intentamos interpretar con Gemini; si falla (sin cuota, 429/503, etc.)
    // usamos el plan B por palabras clave para que el bot siga respondiendo.
    let accionDetectada: AccionChatbot
    try {
      const interpretacion = await interpretarMensaje(texto, contexto)
      accionDetectada = parsearAccionGemini(interpretacion ?? undefined)
      if (!accionDetectada.accion) {
        const respaldo = interpretarMensajeFallback(texto, contexto)
        if (respaldo.accion) accionDetectada = respaldo
      }
    } catch (errGemini) {
      console.warn('Gemini no disponible, usando interpretación por palabras clave:', errGemini)
      accionDetectada = interpretarMensajeFallback(texto, contexto)
    }

    const accion = unirAcciones(contexto?.datos, accionDetectada)

    let resultado
    let mantenerContexto = false
    switch (accion.accion) {
      case 'crear_cita':
        // Si el paciente dio día pero no hora, mostramos las franjas libres
        // de esa fecha para que elija, en vez de pedir la hora en abstracto.
        if (!accion.fecha_hora && accion.fecha) {
          const disp = await consultarDisponibilidad(accion.fecha, accion.especialidad ?? undefined)
          resultado = {
            ok: disp.ok,
            mensaje: disp.ok
              ? `${disp.mensaje} Respóndeme con la hora que prefieras (ej. ${accion.fecha} 09:00) para confirmar tu cita.`
              : disp.mensaje,
          }
          await guardarContextoWhatsapp(from, {
            pendiente: true,
            ultima_accion: 'crear_cita',
            datos: accion,
          })
          mantenerContexto = true
          break
        }
        resultado = await crearCita(paciente, {
          fecha_hora: accion.fecha_hora ?? undefined,
          especialidad: accion.especialidad ?? undefined,
          tratamiento: accion.tratamiento ?? undefined,
          motivo: accion.motivo ?? texto,
        })
        break
      case 'cancelar_cita':
        resultado = await cancelarCita(paciente)
        break
      case 'reprogramar_cita':
        resultado = await reprogramarCita(paciente, {
          fecha_hora: accion.fecha_hora ?? undefined,
        })
        break
      case 'consultar_cita':
        resultado = await consultarCita(paciente)
        break
      case 'consultar_disponibilidad':
        resultado = await consultarDisponibilidad(
          accion.fecha ?? accion.fecha_hora ?? '',
          accion.especialidad ?? undefined
        )
        break
      case 'saludo':
        resultado = {
          ok: true,
          mensaje:
            `¡Hola ${primerNombre}! 👋 Soy el asistente virtual de OdontoCitas. ` +
            `Puedo ayudarte a:\n• Agendar una cita\n• Consultar tu próxima cita\n• Reprogramarla o cancelarla\n• Ver horarios disponibles\n\n¿Qué deseas hacer?`,
        }
        break
      case 'ayuda':
        resultado = {
          ok: true,
          mensaje:
            `Con gusto te ayudo, ${primerNombre}. Estas son las opciones:\n` +
            `• "Quiero agendar una cita de ortodoncia mañana a las 9"\n` +
            `• "¿Cuándo es mi próxima cita?"\n` +
            `• "Reprogramar mi cita para el viernes a las 10"\n` +
            `• "Cancelar mi cita"\n` +
            `• "¿Qué horarios hay disponibles el lunes?"`,
        }
        break
      case 'agradecimiento':
        resultado = { ok: true, mensaje: `¡Con mucho gusto, ${primerNombre}! 😊 ¿Necesitas algo más?` }
        break
      case 'despedida':
        resultado = { ok: true, mensaje: `¡Hasta pronto, ${primerNombre}! Cuídate y sonríe. 🦷✨` }
        break
      default:
        resultado = {
          ok: false,
          mensaje: `Hola ${primerNombre}, puedo ayudarte a agendar, consultar, reprogramar o cancelar tus citas, o a ver horarios disponibles. ¿Qué deseas hacer?`,
        }
    }

    // Solo el flujo de citas administra el contexto: las respuestas
    // conversacionales (saludo, ayuda, etc.) no deben perder un trámite pendiente.
    const accionesCita = ['crear_cita', 'cancelar_cita', 'reprogramar_cita', 'consultar_cita', 'consultar_disponibilidad']
    if (accionesCita.includes(accion.accion ?? '')) {
      if (resultado.ok && !mantenerContexto) {
        await limpiarContextoWhatsapp(from)
      } else if (accion.accion === 'crear_cita' || accion.accion === 'reprogramar_cita') {
        await guardarContextoWhatsapp(from, {
          pendiente: true,
          ultima_accion: accion.accion,
          datos: accion,
        })
      }
    }

    await responderWhatsAppSeguro(from, resultado.mensaje)
  } catch (err) {
    console.error('Error procesando mensaje de WhatsApp:', err)
    await responderWhatsAppSeguro(
      from,
      'Tuve un problema procesando tu mensaje. Intenta de nuevo en unos minutos o comunícate con la clínica.'
    )
  }
}

// Verificación del webhook de WhatsApp Cloud API.
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge)
  }

  return res.sendStatus(403)
})

// Recepción de mensajes entrantes de WhatsApp Cloud API.
router.post('/webhook', async (req: Request, res: Response) => {
  const mensajes = extraerMensajes(req.body)
  if (process.env.NODE_ENV !== 'production' && mensajes.length > 0) {
    console.log(
      `[whatsapp] ${mensajes.length} mensaje(s):`,
      mensajes.map(m => ({ id: m.id, from: m.from, tipo: m.tipo }))
    )
  }
  for (const mensaje of mensajes) {
    void manejarMensajeEntrante(mensaje)
  }
  void limpiarMensajesWhatsappAntiguos()

  res.sendStatus(200)
})

export default router
