const DEFAULT_DEV_SECRET = 'odontocitas_super_secret_key_2026'

let warned = false

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim()
  if (secret) return secret

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatorio en producción')
  }

  if (!warned) {
    console.warn('[auth] JWT_SECRET no configurado; usando valor solo para desarrollo.')
    warned = true
  }
  return DEFAULT_DEV_SECRET
}
