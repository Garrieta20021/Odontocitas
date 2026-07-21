import axios from 'axios'

const GRAPH_VERSION = 'v23.0'

export type MediaDescargado = {
  buffer: Buffer
  mimeType: string
}

// Descarga un archivo (audio, imagen, etc.) recibido por WhatsApp Cloud API.
// El webhook solo entrega un media_id; hay que resolver la URL temporal y
// luego descargar el binario, ambas llamadas autenticadas con el token.
export async function descargarMediaWhatsApp(mediaId: string): Promise<MediaDescargado | null> {
  const token = process.env.WHATSAPP_TOKEN

  if (!token || token === 'xxxxxxxx') {
    console.warn('WhatsApp no configurado; no se puede descargar el audio.')
    return null
  }

  try {
    // 1. Resolver la URL temporal del archivo a partir del media_id.
    const meta = await axios.get<{ url?: string; mime_type?: string }>(
      `https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!meta.data?.url) {
      console.error('No se obtuvo URL de descarga para el media:', mediaId)
      return null
    }

    // 2. Descargar el binario (requiere el header Authorization).
    const archivo = await axios.get<ArrayBuffer>(meta.data.url, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer',
    })

    return {
      buffer: Buffer.from(archivo.data),
      mimeType: meta.data.mime_type ?? 'audio/ogg',
    }
  } catch (err) {
    console.error('Error descargando media de WhatsApp:', err)
    return null
  }
}
