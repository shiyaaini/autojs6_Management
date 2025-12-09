import { API_BASE_URL } from '../config'

export interface ApkItem {
  name: string
  path: string
  size: number
  updatedAt: number
}

interface ApkListResponse {
  items: ApkItem[]
}

interface ApkUploadResponse {
  item: ApkItem
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = ''
    try {
      const text = await response.text()
      detail = text
    } catch (e) {
      detail = `${e}`
    }
    throw new Error(`Request failed (${response.status}): ${detail}`)
  }
  return response.json() as Promise<T>
}

export async function fetchApkList(): Promise<ApkItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/apk/list`, { credentials: 'include' })
  const data = await handleResponse<ApkListResponse>(response)
  return data.items
}

export async function uploadApk(file: File): Promise<ApkItem> {
  const url = `${API_BASE_URL}/api/apk/upload?filename=${encodeURIComponent(file.name)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: file,
    credentials: 'include',
  })
  const data = await handleResponse<ApkUploadResponse>(response)
  return data.item
}
