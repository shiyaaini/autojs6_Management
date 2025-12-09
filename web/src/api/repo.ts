import { API_BASE_URL } from '../config'

export interface RepoScriptItem {
  path: string
  name: string
  size: number
  updatedAt: number
}

interface RepoListResponse {
  scripts: RepoScriptItem[]
}

interface RepoContentResponse {
  item: RepoScriptItem
  content: string
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Request failed (${response.status}): ${text}`)
  }
  return (await response.json()) as T
}

export async function fetchRepoScripts(): Promise<RepoScriptItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/repo/scripts`, { credentials: 'include' })
  const data = await handleResponse<RepoListResponse>(response)
  return data.scripts
}

export async function fetchRepoScriptContent(path: string): Promise<RepoContentResponse> {
  const url = `${API_BASE_URL}/api/repo/scripts/content?path=${encodeURIComponent(path)}`
  const response = await fetch(url, { credentials: 'include' })
  return handleResponse<RepoContentResponse>(response)
}

export async function updateRepoScriptContent(path: string, content: string): Promise<RepoContentResponse> {
  const response = await fetch(`${API_BASE_URL}/api/repo/scripts/content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, content }),
    credentials: 'include',
  })
  return handleResponse<RepoContentResponse>(response)
}

export async function deleteRepoScript(path: string): Promise<void> {
  const url = `${API_BASE_URL}/api/repo/scripts/content?path=${encodeURIComponent(path)}`
  const response = await fetch(url, { method: 'DELETE', credentials: 'include' })
  await handleResponse(response)
}
