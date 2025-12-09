export type DeviceWebSocket = import('ws').WebSocket;

export interface DeviceInfoPayload {
  deviceId: string;
  model?: string;
  androidVersion?: string;
  appVersion?: string;
  manufacturer?: string;
  battery?: number;
  isCharging?: boolean;
  volume?: number;
  brightness?: number;
  bluetoothEnabled?: boolean;
  extra?: Record<string, unknown>;
}

export interface DeviceRecord extends DeviceInfoPayload {
  lastHeartbeat: number;
  status: 'online' | 'offline';
  socket?: DeviceWebSocket;
  scripts: ScriptSummary[];
  folders?: string[];
  apps?: DeviceAppInfo[];
  screenshot?: ScreenshotPayload & { updatedAt: number };
  running?: RunningScriptInfo[];
  scheduled?: ScheduledScriptInfo[];
  remark?: string;
}

export interface DeviceAppInfo {
  packageName: string;
  name: string;
  versionName?: string;
  versionCode?: number;
  targetSdk?: number;
  isSystem?: boolean;
}

export interface ScriptSummary {
  id: string;
  name: string;
  path?: string;
  size?: number;
  updatedAt?: number;
}

export interface ScreenshotPayload {
  deviceId: string;
  contentType: string;
  data: string;
  width?: number;
  height?: number;
  timestamp?: number;
}

export interface RunningScriptInfo {
  id: string;
  name?: string;
  pid?: number;
  startedAt?: number;
}

export interface ScheduledScriptInfo {
  id: string;
  name?: string;
  cron?: string;
  nextRunAt?: number;
  // 设备内部的任务 ID，用于删除等操作，例如 timed:123 / intent:5
  scheduleId?: string;
  // 任务类型：timed 表示 TimedTask，intent 表示广播触发任务
  type?: 'timed' | 'intent';
}

export interface TouchEventPayload {
  type: 'tap' | 'swipe' | 'long_press';
  start: { x: number; y: number };
  end?: { x: number; y: number };
  durationMs?: number;
}

export type DeviceAction = 'back' | 'home' | 'volume_up' | 'volume_down' | 'mute';

export type DeviceToServerMessage =
  | { type: 'DEVICE_INFO'; payload: DeviceInfoPayload }
  | {
      type: 'HEARTBEAT';
      payload: {
        timestamp?: number;
        battery?: number;
        isCharging?: boolean;
        volume?: number;
        brightness?: number;
        bluetoothEnabled?: boolean;
      };
    }
  | { type: 'SCRIPT_LIST'; payload: { deviceId: string; scripts: ScriptSummary[]; folders?: string[] } }
  | { type: 'SCRIPT_STATUS_UPDATE'; payload: { deviceId: string; scriptId: string; status: string; detail?: string } }
  | { type: 'SCREENSHOT'; payload: ScreenshotPayload }
  | { type: 'RUNNING_SCRIPTS'; payload: { deviceId: string; items: RunningScriptInfo[] } }
  | { type: 'SCHEDULED_SCRIPTS'; payload: { deviceId: string; items: ScheduledScriptInfo[] } }
  | { type: 'INSTALLED_APPS'; payload: { deviceId: string; apps: DeviceAppInfo[] } }
  | { type: 'LOG_LINES'; payload: { deviceId: string; scriptId: string; lines: string[]; timestamp?: number } }
  | { type: 'SCRIPT_CONTENT'; payload: { deviceId: string; scriptId: string; content: string } };

export type ServerToDeviceMessage =
  | { type: 'REQUEST_SCRIPT_LIST' }
  | { type: 'PUSH_SCRIPT'; payload: { scriptId: string; name: string; content: string; runImmediately?: boolean } }
  | { type: 'RUN_SCRIPT'; payload: { scriptId: string } }
  | { type: 'STOP_SCRIPT'; payload: { scriptId: string } }
  | { type: 'REQUEST_SCREENSHOT'; payload?: { quality?: number; maxWidth?: number; maxHeight?: number } }
  | { type: 'REQUEST_INSTALLED_APPS' }
  | { type: 'TOUCH_EVENT'; payload: TouchEventPayload }
  | { type: 'DEVICE_ACTION'; payload: { action: DeviceAction } }
  | { type: 'REQUEST_RUNNING_SCRIPTS' }
  | { type: 'REQUEST_SCHEDULED_SCRIPTS' }
  | { type: 'REQUEST_LOG_TAIL'; payload: { scriptId: string; lines?: number } }
  | { type: 'REQUEST_SCRIPT_CONTENT'; payload: { scriptId: string } }
  | { type: 'UPDATE_SCRIPT_CONTENT'; payload: { scriptId: string; content: string } }
  | { type: 'DELETE_SCRIPT'; payload: { scriptId: string } }
  | { type: 'DELETE_SCHEDULED_TASK'; payload: { id: string } }
  | { type: 'CREATE_INTENT_TASK'; payload: { scriptId: string; action: string; local?: boolean } }
  | {
      type: 'CREATE_TIMED_TASK';
      payload: {
        scriptId: string;
        mode: 'once' | 'daily' | 'weekly';
        // once: timestamp 为毫秒时间戳
        timestamp?: number;
        // daily: HH:mm 形式的时间字符串
        timeOfDay?: string;
        // weekly: 一周中的哪些天，1=周一 ... 7=周日
        daysOfWeek?: number[];
      };
    }
  | {
      type: 'INSTALL_APK';
      payload: { apkName: string; mode?: 'auto' | 'normal' | 'root' };
    };
