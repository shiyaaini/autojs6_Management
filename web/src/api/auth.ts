import { API_BASE_URL } from '../config'

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || String(response.status))
  }
  return (await response.json()) as T
}

export async function getAuthStatus(): Promise<{ locked: boolean; lockedUntil?: number; remainingAttempts?: number; authenticated?: boolean }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/status`, { credentials: 'include' })
  return handleResponse(res)
}

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include',
  })
  const data = await handleResponse<{ token: string }>(res)
  return data.token
}

export async function logout(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
  await handleResponse(res)
}

export async function changeAdminCredentials(
  username: string,
  password: string,
  currentPassword: string,
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/auth/change`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, currentPassword }),
    credentials: 'include',
  })
  const data = await handleResponse<{ username: string }>(res)
  return data.username
}