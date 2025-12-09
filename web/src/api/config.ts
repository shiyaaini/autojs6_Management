import { API_BASE_URL } from '../config'

interface MatchCodeResponse {
  matchCode: string
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Request failed (${response.status}): ${text}`)
  }
  return (await response.json()) as T
}

export async function fetchMatchCode(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/config/secret`, { credentials: 'include' })
  const data = await handleResponse<MatchCodeResponse>(response)
  return data.matchCode
}

export async function updateMatchCode(matchCode: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/config/secret`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ matchCode }),
    credentials: 'include',
  })
  const data = await handleResponse<MatchCodeResponse>(response)
  return data.matchCode
}
