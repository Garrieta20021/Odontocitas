import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
})

function fechaColombia(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
}

// Transcribe una nota de voz a texto usando Gemini (entrada multimodal).
// Recibe el audio en base64 y su mime type (ej. "audio/ogg").
export async function transcribirAudio(audioBase64: string, mimeType: string): Promise<string | null> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        text:
          'Transcribe exactamente lo que dice esta nota de voz en español. ' +
          'Devuelve únicamente el texto transcrito, sin comillas ni comentarios. ' +
          'Si no se entiende o no hay voz, responde exactamente: SIN_AUDIO.',
      },
      {
        inlineData: {
          mimeType,
          data: audioBase64,
        },
      },
    ],
  })

  const texto = response.text?.trim()
  if (!texto || texto.toUpperCase().includes('SIN_AUDIO')) return null
  return texto
}

export async function interpretarMensaje(mensaje: string, contexto?: unknown) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    config: {
      responseMimeType: 'application/json',
    },
    contents: `
Eres el asistente virtual de OdontoCitas.

Debes responder únicamente JSON válido, sin markdown, sin explicaciones y sin texto adicional.

Acciones:

crear_cita
cancelar_cita
reprogramar_cita
consultar_cita
consultar_disponibilidad
saludo (cuando el paciente saluda: "hola", "buenas", etc.)
ayuda (cuando pide ayuda o no sabe qué puede hacer)
agradecimiento (cuando agradece: "gracias")
despedida (cuando se despide: "adiós", "chao")

Formato exacto:
{
  "accion": "crear_cita | cancelar_cita | reprogramar_cita | consultar_cita | consultar_disponibilidad | saludo | ayuda | agradecimiento | despedida",
  "fecha_hora": "YYYY-MM-DD HH:mm o null",
  "fecha": "YYYY-MM-DD o null",
  "tratamiento": "nombre del tratamiento o null",
  "especialidad": "general | ortodoncia | endodoncia | cirugia | blanqueamiento | pediatrica | null",
  "motivo": "texto corto o null"
}

Reglas:
- Usa siempre la zona horaria de Colombia (America/Bogota).
- Si el paciente dice "mañana", "hoy", "el viernes" o una hora suelta, resuélvelo usando el contexto si existe.
- Si el paciente responde solo una hora y en el contexto hay fecha/acción pendiente, conserva esos datos.
- Si no hay fecha/hora suficiente, usa null.
- No inventes tratamiento ni especialidad si el paciente no lo menciona.

Fecha y hora actual en Colombia: ${fechaColombia()}.

Contexto previo:
${JSON.stringify(contexto ?? {}, null, 2)}

Mensaje:
${mensaje}
`,
  })

  return response.text
}
