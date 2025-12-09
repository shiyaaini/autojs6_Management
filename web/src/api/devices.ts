import { API_BASE_URL } from '../config'
import type {
  Device,
  ScriptRunRecord,
  ScriptSummary,
  ScreenshotPayload,
  TouchEventPayload,
  RunningScriptInfo,
  ScheduledScriptInfo,
  DeviceAction,
  DeviceAppInfo,
  DeviceStatusStats,
} from '../types'

interface DeviceListResponse {
  devices: Device[]
}

interface DeviceResponse {
  device: Device
}

interface ScriptListResponse {
  scripts: ScriptSummary[]
}

interface ScriptRunResponse {
  runs: ScriptRunRecord[]
}

interface ScreenshotResponse {
  screenshot: ScreenshotPayload | null
}

interface RunningScriptsResponse {
  items: RunningScriptInfo[]
}

interface ScheduledScriptsResponse {
  items: ScheduledScriptInfo[]
}

interface DeviceAppsResponse {
	apps: DeviceAppInfo[]
}

interface LogsResponse {
  lines: string[]
}

interface ScriptContentResponse {
  content: string
}

interface RemarkResponse {
  remark: string
}

type DeviceStatusStatsResponse = DeviceStatusStats

type TimedTaskMode = 'once' | 'daily' | 'weekly'
type ApkInstallMode = 'auto' | 'normal' | 'root'

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

export async function fetchDevices(): Promise<Device[]> {
  const response = await fetch(`${API_BASE_URL}/api/devices`)
  const data = await handleResponse<DeviceListResponse>(response)
  return data.devices
}

export async function fetchDevice(deviceId: string): Promise<Device> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}`)
  const data = await handleResponse<DeviceResponse>(response)
  return data.device
}

export async function fetchDeviceStatusStats(deviceId: string, from: number, to: number): Promise<DeviceStatusStats> {
  const query = `?from=${encodeURIComponent(String(from))}&to=${encodeURIComponent(String(to))}`
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/status-stats${query}`)
  const data = await handleResponse<DeviceStatusStatsResponse>(response)
  return data
}

export async function deleteDevice(deviceId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}`, {
    method: 'DELETE',
  })
  await handleResponse(response)
}

export async function fetchDeviceScripts(deviceId: string): Promise<ScriptSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/scripts`)
  const data = await handleResponse<ScriptListResponse>(response)
  return data.scripts
}

export async function fetchDeviceApps(deviceId: string): Promise<DeviceAppInfo[]> {
	const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/apps`)
	const data = await handleResponse<DeviceAppsResponse>(response)
	return data.apps
}

export async function fetchDeviceScriptRuns(deviceId: string, scriptId?: string): Promise<ScriptRunRecord[]> {
  const query = scriptId ? `?scriptId=${encodeURIComponent(scriptId)}` : ''
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/script-runs${query}`)
  const data = await handleResponse<ScriptRunResponse>(response)
  return data.runs
}

export async function requestDeviceScriptList(deviceId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/request-script-list`, { method: 'POST' })
  await handleResponse(response)
}

export async function requestDeviceApps(deviceId: string): Promise<void> {
	const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/request-apps`, { method: 'POST' })
	await handleResponse(response)
}

export async function createDeviceTimedTask(
  deviceId: string,
  payload: { scriptId: string; mode: TimedTaskMode; timestamp?: number; timeOfDay?: string; daysOfWeek?: number[] },
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/scheduled-tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  await handleResponse(response)
}

export async function installApkOnDevice(
  deviceId: string,
  apkName: string,
  mode?: ApkInstallMode,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/install-apk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ apkName, ...(mode ? { mode } : {}) }),
  })
  await handleResponse(response)
}

export async function sendDeviceAction(deviceId: string, action: DeviceAction): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action }),
  })
  await handleResponse(response)
}

export async function createDeviceBroadcastTask(
  deviceId: string,
  payload: { scriptId: string; action: string; local?: boolean },
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/broadcast-tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  await handleResponse(response)
}

export async function deleteDeviceScheduledTask(deviceId: string, id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/delete-scheduled`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  })
  await handleResponse(response)
}

export async function runDeviceScript(deviceId: string, scriptId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/run-script`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scriptId }),
  })
  await handleResponse(response)
}

export async function deleteDeviceScripts(deviceId: string, scriptIds: string[]): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/delete-scripts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scriptIds }),
  })
  await handleResponse(response)
}

export async function updateDeviceRemark(deviceId: string, remark: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/remark`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ remark }),
  })
  const data = await handleResponse<RemarkResponse>(response)
  return data.remark
}

export async function pushInlineScriptToDevice(
  deviceId: string,
  options: { name: string; content: string; runImmediately?: boolean; targetFolder?: string },
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/push-inline-script`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  })
  await handleResponse(response)
}

export async function pushScriptToDevice(deviceId: string, options: {
  path: string
  runImmediately?: boolean
  scriptId?: string
  targetFolder?: string
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/push-script`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  })
  await handleResponse(response)
}

export async function createDeviceFolder(deviceId: string, folder: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/create-folder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ folder }),
  })
  await handleResponse(response)
}

export async function requestRunningScripts(deviceId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/request-running`, { method: 'POST' })
  await handleResponse(response)
}

export async function requestScheduledScripts(deviceId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/request-scheduled`, { method: 'POST' })
  await handleResponse(response)
}

export async function fetchRunningScripts(deviceId: string): Promise<RunningScriptInfo[]> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/running`)
  const data = await handleResponse<RunningScriptsResponse>(response)
  return data.items
}

export async function fetchScheduledScripts(deviceId: string): Promise<ScheduledScriptInfo[]> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/scheduled`)
  const data = await handleResponse<ScheduledScriptsResponse>(response)
  return data.items
}

export async function requestScriptLog(deviceId: string, scriptId: string, lines?: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/request-log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scriptId, lines }),
  })
  await handleResponse(response)
}

export async function fetchScriptLog(deviceId: string, scriptId: string, lines = 200): Promise<string[]> {
  const query = `?scriptId=${encodeURIComponent(scriptId)}&lines=${encodeURIComponent(String(lines))}`
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/logs${query}`)
  const data = await handleResponse<LogsResponse>(response)
  return data.lines
}

export async function requestScriptContent(deviceId: string, scriptId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/request-script-content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scriptId }),
  })
  await handleResponse(response)
}

export async function fetchScriptContent(deviceId: string, scriptId: string): Promise<string> {
  const query = `?scriptId=${encodeURIComponent(scriptId)}`
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/script-content${query}`)
  const data = await handleResponse<ScriptContentResponse>(response)
  return data.content
}

export async function updateDeviceScript(deviceId: string, scriptId: string, content: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/update-script-content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scriptId, content }),
  })
  await handleResponse(response)
}

export async function fetchRunScriptLog(
  deviceId: string,
  scriptId: string,
  timestamp: number,
  lines = 200,
): Promise<string[]> {
  const query = `?scriptId=${encodeURIComponent(scriptId)}&timestamp=${encodeURIComponent(String(timestamp))}&lines=${encodeURIComponent(String(lines))}`
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/run-logs${query}`)
  const data = await handleResponse<LogsResponse>(response)
  return data.lines
}

export async function fetchScreenshot(deviceId: string): Promise<ScreenshotPayload | null> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/screenshot`)
  const data = await handleResponse<ScreenshotResponse>(response)
  if (!data.screenshot) {
    // 对于没有可用截图的情况，前端将其视为正常的“暂无截图”状态
    return null
  }
  return data.screenshot
}

export async function requestScreenshot(
  deviceId: string,
  options?: { quality?: number; maxWidth?: number; maxHeight?: number },
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/request-screenshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options ?? {}),
  })
  await handleResponse(response)
}

export async function sendTouchEvent(deviceId: string, payload: TouchEventPayload): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/touch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  await handleResponse(response)
}
