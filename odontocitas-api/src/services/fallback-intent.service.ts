import { HORARIOS_DISPONIBLES } from './citas.service'
import type { AccionChatbot } from './whatsapp-conversation.service'

// Interpretación de respaldo por palabras clave: se usa cuando Gemini no está
// disponible (sin cuota, 429/503, etc.) para que el bot siga respondiendo.

const ESPECIALIDADES: Array<{ valor: string; claves: string[] }> = [
  { valor: 'ortodoncia', claves: ['ortodoncia', 'bracket', 'brackets', 'frenillo'] },
  { valor: 'endodoncia', claves: ['endodoncia', 'conducto', 'nervio'] },
  { valor: 'cirugia', claves: ['cirugia', 'cirugía', 'extraccion', 'extracción', 'cordal', 'muela del juicio'] },
  { valor: 'blanqueamiento', claves: ['blanqueamiento', 'blanquear', 'blanqueo'] },
  { valor: 'pediatrica', claves: ['pediatrica', 'pediátrica', 'niño', 'niña', 'infantil'] },
  { valor: 'general', claves: ['general', 'limpieza', 'profilaxis', 'control', 'revision', 'revisión', 'caries'] },
]

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3,
  jueves: 4, viernes: 5, sabado: 6, sábado: 6,
}

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function hoyColombia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + dias)
  return dt.toISOString().slice(0, 10)
}

function diaSemanaDeFecha(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 17)).getUTCDay()
}

function detectarAccionCita(t: string): string | null {
  if (/(cancel|anular|anula)/.test(t)) return 'cancelar_cita'
  if (/(reprogram|reagend|cambiar la cita|cambiar mi cita|mover la cita|mover mi cita|cambiar de (fecha|hora)|otra fecha|otro dia|otra hora)/.test(t)) return 'reprogramar_cita'
  if (/(disponib|horarios|que horas|cuales horas|cupos|espacios|que dias|cuando puedo|que tienen libre)/.test(t)) return 'consultar_disponibilidad'
  if (/(mi cita|mis citas|que cita|cuando es mi|cuando tengo|consultar cita|tengo cita|ver cita|tengo agendad)/.test(t)) return 'consultar_cita'
  if (/(agend|cita|reserv|sacar una|sacar cita|quiero una|quiero cita|necesito una|nueva cita|pedir cita|programar|separar)/.test(t)) return 'crear_cita'
  return null
}

function detectarConversacional(t: string): string | null {
  if (/(^|\s)(hola|holi|holaa|buenas|buenos dias|buenas tardes|buenas noches|que tal|que mas|qubo|quiubo|hey|saludos|buen dia)(\s|$|!|,|\.)/.test(t)) return 'saludo'
  if (/(gracias|muchas gracias|mil gracias|te lo agradezco|agradecido|agradecida)/.test(t)) return 'agradecimiento'
  if (/(adios|chao|chau|hasta luego|nos vemos|hasta pronto|bye|me despido)/.test(t)) return 'despedida'
  if (/(ayuda|que puedes hacer|que haces|opciones|menu|como funciona|para que sirves|que sabes hacer|info|informacion)/.test(t)) return 'ayuda'
  if (/(^|\s)(si|sii|claro|dale|ok|okay|oki|listo|de acuerdo|confirmo|perfecto|esta bien|correcto)(\s|$|!|,|\.)/.test(t)) return 'afirmacion'
  return null
}

function detectarEspecialidad(t: string): string | null {
  for (const esp of ESPECIALIDADES) {
    if (esp.claves.some(c => t.includes(c))) return esp.valor
  }
  return null
}

function detectarFecha(t: string): string | null {
  const hoy = hoyColombia()

  if (/\bpasado manana\b|\bpasado mañana\b/.test(t)) return sumarDias(hoy, 2)
  if (/\bmanana\b|\bmañana\b/.test(t)) return sumarDias(hoy, 1)
  if (/\bhoy\b/.test(t)) return hoy

  // Fecha explícita YYYY-MM-DD
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // Fecha tipo DD/MM o DD-MM (asume año actual de Colombia)
  const dm = t.match(/\b(\d{1,2})[/](\d{1,2})(?:[/](\d{2,4}))?\b/)
  if (dm) {
    const dia = dm[1].padStart(2, '0')
    const mes = dm[2].padStart(2, '0')
    const anio = dm[3] ? (dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : hoy.slice(0, 4)
    return `${anio}-${mes}-${dia}`
  }

  // Día de la semana: próxima ocurrencia
  for (const [nombre, dow] of Object.entries(DIAS_SEMANA)) {
    if (new RegExp(`\\b${nombre}\\b`).test(t)) {
      let fecha = sumarDias(hoy, 1)
      for (let i = 0; i < 7; i++) {
        if (diaSemanaDeFecha(fecha) === dow) return fecha
        fecha = sumarDias(fecha, 1)
      }
    }
  }

  return null
}

function detectarHora(t: string): string | null {
  // HH:mm o HH.mm
  const hm = t.match(/\b(\d{1,2})[:.](\d{2})\b/)
  if (hm) {
    let h = Number(hm[1])
    const min = hm[2]
    if (/\b(pm|p\.m|tarde|noche)\b/.test(t) && h < 12) h += 12
    return `${String(h).padStart(2, '0')}:${min}`
  }

  // "2 de la tarde", "9 de la mañana", "10 am", "3 pm"
  const suelta = t.match(/\b(\d{1,2})\s*(am|a\.m|pm|p\.m|de la manana|de la mañana|de la tarde|de la noche)\b/)
  if (suelta) {
    let h = Number(suelta[1])
    const suf = suelta[2]
    const esTarde = /pm|p\.m|tarde|noche/.test(suf)
    if (esTarde && h < 12) h += 12
    return `${String(h).padStart(2, '0')}:00`
  }

  // "a las 9" / "a las 3": hora cruda interpretada según horario de la clínica
  const aLas = t.match(/\ba\s+las\s+(\d{1,2})\b/)
  if (aLas) {
    let h = Number(aLas[1])
    if (h >= 1 && h <= 6) h += 12 // 1–6 = tarde
    return `${String(h).padStart(2, '0')}:00`
  }

  return null
}

function combinarFechaHora(fecha: string | null, hora: string | null): string | null {
  if (!fecha || !hora) return null
  if (!HORARIOS_DISPONIBLES.includes(hora)) return null
  return `${fecha} ${hora}`
}

export function interpretarMensajeFallback(mensaje: string, contexto?: unknown): AccionChatbot {
  const t = normalizar(mensaje)

  const ctxDatos = (contexto as { datos?: AccionChatbot } | null)?.datos
  const fecha = detectarFecha(t)
  const hora = detectarHora(t)
  const fechaHora = combinarFechaHora(fecha, hora)

  const accionCita = detectarAccionCita(t)
  const conversacional = accionCita ? null : detectarConversacional(t)

  let accion: string | null
  if (accionCita) {
    accion = accionCita
  } else if (conversacional === 'afirmacion') {
    // "sí / ok / dale": si hay un trámite pendiente, lo retomamos; si no, ayuda.
    accion = ctxDatos?.accion ?? 'ayuda'
  } else if (conversacional) {
    accion = conversacional
  } else if (fecha || hora) {
    // El paciente solo mandó fecha/hora: continúa el trámite pendiente.
    accion = ctxDatos?.accion ?? 'crear_cita'
  } else {
    accion = ctxDatos?.accion ?? null
  }

  return {
    accion,
    fecha_hora: fechaHora,
    fecha,
    tratamiento: null,
    especialidad: detectarEspecialidad(t),
    motivo: mensaje,
  }
}
