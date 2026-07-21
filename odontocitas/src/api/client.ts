const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function getToken(): string | null {
  return localStorage.getItem('odontocitas_token')
}

export function setToken(token: string): void {
  localStorage.setItem('odontocitas_token', token)
}

export function removeToken(): void {
  localStorage.removeItem('odontocitas_token')
  localStorage.removeItem('odontocitas_user')
  window.dispatchEvent(new Event('odontocitas:unauthorized'))
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, ...init } = options

  let url = `${BASE_URL}${path}`
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&')
    if (qs) url += `?${qs}`
  }

  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, { ...init, headers })
  const data = await res.json().catch(() => ({} as Record<string, unknown>))

  if (res.status === 401) {
    const mensaje =
      (data as { error?: string }).error ||
      (data as { errors?: { msg: string }[] }).errors?.[0]?.msg ||
      'No autorizado'

    // En login un 401 significa credenciales incorrectas, no sesión expirada.
    if (path === '/auth/login') {
      throw new Error(
        mensaje === 'No autorizado' ? 'Credenciales incorrectas' : mensaje
      )
    }

    removeToken()
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
    throw new Error(
      mensaje === 'Token inválido o expirado' || mensaje === 'No autorizado'
        ? 'Sesión expirada'
        : mensaje
    )
  }

  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ||
      (data as { errors?: { msg: string }[] }).errors?.[0]?.msg ||
      'Error en la solicitud'
    )
  }

  return data as T
}

export const api = {
  get: <T>(path: string, params?: RequestOptions['params']) =>
    request<T>(path, { method: 'GET', params }),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
}
