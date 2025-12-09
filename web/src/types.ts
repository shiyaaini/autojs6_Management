export interface ScriptSummary {
  id: string
  name: string
  path?: string
  size?: number
  updatedAt?: number
}

export interface DeviceAppInfo {
  name: string
  packageName: string
  versionName?: string
  versionCode?: number
  targetSdk?: number
  isSystem?: boolean
}

export interface Device {
  deviceId: string
  model?: string
  androidVersion?: string
  appVersion?: string
  manufacturer?: string
  lastHeartbeat?: number
  status: 'online' | 'offline'
  scripts?: ScriptSummary[]
  folders?: string[]
  apps?: DeviceAppInfo[]
  remark?: string
  battery?: number
  isCharging?: boolean
  volume?: number
  brightness?: number
  bluetoothEnabled?: boolean
}

export interface ScriptRunRecord {
  scriptId: string
  status: string
  detail?: string
  timestamp: number
}

export interface ScreenshotPayload {
  deviceId: string
  contentType: string
  data: string
  width?: number
  height?: number
  timestamp?: number
}

export interface TouchEventPayload {
  type: 'tap' | 'swipe' | 'long_press'
  start: { x: number; y: number }
  end?: { x: number; y: number }
  durationMs?: number
}

export type DeviceAction = 'back' | 'home' | 'volume_up' | 'volume_down' | 'mute'

export interface RunningScriptInfo {
  id: string
  name?: string
  pid?: number
  startedAt?: number
}

export interface ScheduledScriptInfo {
  id: string
  name?: string
  cron?: string
  nextRunAt?: number
  // 设备内部任务 ID，用于删除等操作，例如 timed:123 / intent:5
  scheduleId?: string
  // 任务类型：timed 表示 TimedTask，intent 表示广播触发任务
  type?: 'timed' | 'intent'
}

export interface DeviceStatusSegment {
  start: number
  end: number
  status: 'online' | 'offline'
}

export interface DeviceStatusStats {
  from: number
  to: number
  segments: DeviceStatusSegment[]
  totalOnlineMs: number
  totalOfflineMs: number
}
