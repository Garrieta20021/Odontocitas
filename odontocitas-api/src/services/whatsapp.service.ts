import axios from 'axios'

const GRAPH_VERSION = 'v23.0'

export async function enviarMensajeWhatsApp(to: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!token || !phoneNumberId || token === 'xxxxxxxx' || phoneNumberId === 'xxxxxxxx') {
    console.warn('WhatsApp no configurado. Respuesta pendiente:', { to, body })
    return
  }

  await axios.post(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )
}
