const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '')

export const tokenStore = {
  get: () => localStorage.getItem('gd_token'),
  set: (token) => localStorage.setItem('gd_token', token),
  clear: () => localStorage.removeItem('gd_token'),
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {})
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const token = tokenStore.get()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) tokenStore.clear()
    throw new Error(data?.message || `요청에 실패했습니다. (${response.status})`)
  }
  return data
}

export function apiUrl() {
  return API_BASE
}
