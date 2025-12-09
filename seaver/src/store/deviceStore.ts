import { DeviceRecord, DeviceInfoPayload, DeviceWebSocket, ScriptSummary, ScreenshotPayload, RunningScriptInfo, ScheduledScriptInfo, DeviceAppInfo } from '../types';
import { getAllRemarks, setRemark, appendDeviceStatusEvent } from '../db/database';

export interface ScriptRunRecord {
  scriptId: string;
  status: string;
  detail?: string;
  timestamp: number;
}

interface StatusEvent {
  timestamp: number;
  status: 'online' | 'offline';
}

const MAX_RUN_HISTORY = 50;
const HEARTBEAT_TIMEOUT = 120 * 1000; // 120 seconds
const CHECK_INTERVAL = 5 * 1000; // Check every 5 seconds
const STATUS_HISTORY_RETENTION = 7 * 24 * 60 * 60 * 1000; // 7 days

const sanitizeDevice = (device: DeviceRecord) => {
  const { socket, ...rest } = device;
  return rest;
};

class DeviceStore {
  private devices = new Map<string, DeviceRecord>();
  private scriptRuns = new Map<string, ScriptRunRecord[]>();
  // 当前脚本的最新/正在运行日志：deviceId -> scriptId -> tail lines
  private logs = new Map<string, Map<string, string[]>>();
  // 每次运行的快照日志：deviceId -> runKey(scriptId::timestamp) -> tail lines
  private runLogs = new Map<string, Map<string, string[]>>();
  // 最近一次从设备获取到的脚本内容：deviceId -> scriptId -> content
  private scriptContents = new Map<string, Map<string, string>>();
  
  // Cache for remarks loaded from DB
  private remarks = new Map<string, string>();

  // 历史在线/离线事件：deviceId -> events
  private statusHistory = new Map<string, StatusEvent[]>();

  constructor() {
    this.loadRemarks();
    setInterval(() => this.checkHeartbeats(), CHECK_INTERVAL);
  }

  private async loadRemarks() {
    try {
      const loaded = await getAllRemarks();
      for (const [id, remark] of Object.entries(loaded)) {
        this.remarks.set(id, remark);
        // Update existing device records if any (though unlikely on startup)
        const device = this.devices.get(id);
        if (device) {
          device.remark = remark;
        }
      }
    } catch (err) {
      console.error('Failed to load remarks from DB:', err);
    }
  }

  private recordStatus(deviceId: string, newStatus: 'online' | 'offline') {
    const device = this.devices.get(deviceId);
    if (!device) return;
    if (device.status === newStatus) return;

    device.status = newStatus;

    const now = Date.now();
    const events = this.statusHistory.get(deviceId) ?? [];
    events.push({ timestamp: now, status: newStatus });

    const cutoff = now - STATUS_HISTORY_RETENTION;
    while (events.length > 0 && events[0].timestamp < cutoff) {
      events.shift();
    }
    this.statusHistory.set(deviceId, events);

    appendDeviceStatusEvent(deviceId, now, newStatus).catch((err: unknown) => {
      console.error('Failed to persist status event for', deviceId, newStatus, err);
    });
  }

  checkHeartbeats() {
    const now = Date.now();
    for (const [deviceId, device] of this.devices.entries()) {
      if (device.status === 'online') {
        if (now - device.lastHeartbeat > HEARTBEAT_TIMEOUT) {
          console.log(`[DeviceStore] Device ${deviceId} heartbeat timeout, marking offline`);
          this.recordStatus(deviceId, 'offline');
          this.detachSocket(deviceId);
        }
      }
    }
  }

  deleteDevice(deviceId: string) {
    this.detachSocket(deviceId);
    this.devices.delete(deviceId);
    this.scriptRuns.delete(deviceId);
    this.logs.delete(deviceId);
    this.runLogs.delete(deviceId);
    this.scriptContents.delete(deviceId);
    return true;
  }

  private makeRunKey(scriptId: string, timestamp: number) {
    return `${scriptId}::${timestamp}`;
  }

  upsertDevice(info: DeviceInfoPayload, socket?: DeviceWebSocket) {
    const existing = this.devices.get(info.deviceId);
    const now = Date.now();
    
    // Ensure remark is loaded from cache if not already in existing
    const remark = existing?.remark ?? this.remarks.get(info.deviceId);

    const updated: DeviceRecord = {
      deviceId: info.deviceId,
      model: info.model ?? existing?.model,
      androidVersion: info.androidVersion ?? existing?.androidVersion,
      appVersion: info.appVersion ?? existing?.appVersion,
      manufacturer: info.manufacturer ?? existing?.manufacturer,
      battery: info.battery ?? existing?.battery,
      isCharging: info.isCharging ?? existing?.isCharging,
      volume: info.volume ?? existing?.volume,
      brightness: info.brightness ?? existing?.brightness,
      bluetoothEnabled: info.bluetoothEnabled ?? existing?.bluetoothEnabled,
      extra: { ...existing?.extra, ...info.extra },
      lastHeartbeat: now,
      // 对于首次见到的设备，默认从 offline 过渡到 online，这样首次上线也会记录一条状态事件
      status: existing?.status ?? 'offline',
      scripts: existing?.scripts ?? [],
      folders: existing?.folders ?? [],
      screenshot: existing?.screenshot,
      socket: socket ?? existing?.socket,
      remark: remark,
    };

    if (socket) {
      updated.socket = socket;
    }

    this.devices.set(info.deviceId, updated);
    this.recordStatus(info.deviceId, 'online');
  }

  attachSocket(deviceId: string, socket: DeviceWebSocket) {
    const device = this.devices.get(deviceId);
    if (!device) {
      this.upsertDevice({ deviceId }, socket);
      return;
    }
    device.socket = socket;
    device.lastHeartbeat = Date.now();
    this.recordStatus(deviceId, 'online');
  }

  detachSocket(deviceId: string) {
    const device = this.devices.get(deviceId);
    if (!device) return;
    // Don't remove the socket reference entirely if we want to keep it for potential cleanup?
    // But typically detach means connection is gone.
    // However, simply setting status to offline is enough for UI.
    // Closing socket might be good if it's not already closed.
    try {
      if (device.socket && device.socket.readyState === device.socket.OPEN) {
        device.socket.close();
      }
    } catch (e) {
      // ignore
    }
    device.socket = undefined;
  }

  markOffline(socket: DeviceWebSocket) {
    for (const [deviceId, record] of this.devices.entries()) {
      if (record.socket === socket) {
        this.detachSocket(deviceId);
        break;
      }
    }
  }

  updateHeartbeat(deviceId: string, payload?: Partial<DeviceInfoPayload>) {
    const device = this.devices.get(deviceId);
    if (!device) return;
    device.lastHeartbeat = Date.now();
    this.recordStatus(deviceId, 'online');
    if (payload) {
      if (payload.battery !== undefined) device.battery = payload.battery;
      if (payload.isCharging !== undefined) device.isCharging = payload.isCharging;
      if (payload.volume !== undefined) device.volume = payload.volume;
      if (payload.brightness !== undefined) device.brightness = payload.brightness;
      if (payload.bluetoothEnabled !== undefined) device.bluetoothEnabled = payload.bluetoothEnabled;
    }
  }

  updateScripts(deviceId: string, scripts: ScriptSummary[], folders?: string[]) {
    const device = this.devices.get(deviceId);
    if (!device) return;
    device.scripts = scripts;
    if (folders) {
      device.folders = folders;
    }
  }

  updateApps(deviceId: string, apps: DeviceAppInfo[]) {
    const device = this.devices.get(deviceId);
    if (!device) return;
    device.apps = apps;
  }

  updateRunning(deviceId: string, items: RunningScriptInfo[]) {
    const device = this.devices.get(deviceId);
    if (!device) return;
    device.running = items;
  }

  updateScheduled(deviceId: string, items: ScheduledScriptInfo[]) {
    const device = this.devices.get(deviceId);
    if (!device) return;
    device.scheduled = items;
  }

  updateScreenshot(deviceId: string, payload: ScreenshotPayload) {
    const device = this.devices.get(deviceId);
    if (!device) {
      return;
    }
    device.screenshot = {
      ...payload,
      updatedAt: Date.now(),
    };
  }

  getDevices() {
    return Array.from(this.devices.values()).map(sanitizeDevice);
  }

  getDevice(deviceId: string) {
    const device = this.devices.get(deviceId);
    return device ? sanitizeDevice(device) : undefined;
  }

  getDeviceRaw(deviceId: string) {
    return this.devices.get(deviceId);
  }

  getRunning(deviceId: string) {
    const device = this.devices.get(deviceId);
    return device?.running ?? [];
  }

  getScheduled(deviceId: string) {
    const device = this.devices.get(deviceId);
    return device?.scheduled ?? [];
  }

  getApps(deviceId: string) {
    const device = this.devices.get(deviceId);
    return device?.apps ?? [];
  }

  getStatusStats(deviceId: string, from: number, to: number) {
    const device = this.devices.get(deviceId);
    if (!device) return null;
    if (to <= from) {
      return { from, to, segments: [] as { start: number; end: number; status: 'online' | 'offline' }[], totalOnlineMs: 0, totalOfflineMs: 0 };
    }

    const events = this.statusHistory.get(deviceId) ?? [];
    if (events.length === 0) {
      // 没有任何状态记录，不统计“假想”的离线时长
      return { from, to, segments: [] as { start: number; end: number; status: 'online' | 'offline' }[], totalOnlineMs: 0, totalOfflineMs: 0 };
    }

    const firstEventTs = events[0].timestamp;
    const start = Math.max(from, firstEventTs);
    if (start >= to) {
      // 统计区间完全落在首次事件之前，视为无有效数据
      return { from, to, segments: [] as { start: number; end: number; status: 'online' | 'offline' }[], totalOnlineMs: 0, totalOfflineMs: 0 };
    }

    let lastBefore: StatusEvent | undefined;
    const inRange: StatusEvent[] = [];

    for (const ev of events) {
      if (ev.timestamp < start) {
        lastBefore = ev;
      } else if (ev.timestamp <= to) {
        inRange.push(ev);
      } else {
        break;
      }
    }

    let currentStatus: 'online' | 'offline' = lastBefore ? lastBefore.status : 'offline';
    let cursor = start;
    const segments: { start: number; end: number; status: 'online' | 'offline' }[] = [];

    for (const ev of inRange) {
      const ts = Math.max(ev.timestamp, from);
      if (ts > cursor) {
        segments.push({ start: cursor, end: ts, status: currentStatus });
        cursor = ts;
      }
      currentStatus = ev.status;
    }

    if (cursor < to) {
      segments.push({ start: cursor, end: to, status: currentStatus });
    }

    let totalOnlineMs = 0;
    let totalOfflineMs = 0;
    for (const seg of segments) {
      const dur = seg.end - seg.start;
      if (seg.status === 'online') totalOnlineMs += dur;
      else totalOfflineMs += dur;
    }

    return { from, to, segments, totalOnlineMs, totalOfflineMs };
  }

  getScreenshot(deviceId: string) {
    const device = this.devices.get(deviceId);
    return device?.screenshot;
  }

  setScriptContent(deviceId: string, scriptId: string, content: string) {
    const devMap = this.scriptContents.get(deviceId) ?? new Map<string, string>();
    devMap.set(scriptId, content);
    this.scriptContents.set(deviceId, devMap);
  }

  getScriptContent(deviceId: string, scriptId: string) {
    const devMap = this.scriptContents.get(deviceId);
    return devMap?.get(scriptId);
  }

  recordScriptStatus(deviceId: string, scriptId: string, status: string, detail?: string): ScriptRunRecord {
    const now = Date.now();
    const runs = this.scriptRuns.get(deviceId) ?? [];
    const run: ScriptRunRecord = { scriptId, status, detail, timestamp: now };
    runs.push(run);
    if (runs.length > MAX_RUN_HISTORY) {
      runs.shift();
    }
    this.scriptRuns.set(deviceId, runs);

    // 新的一次运行开始时，清空当前日志缓存，后续的 LOG_LINES 会只针对本次运行
    if (status === 'running') {
      this.clearLogs(deviceId, scriptId);
    }

    return run;
  }

  getScriptRuns(deviceId: string, scriptId?: string) {
    const runs = this.scriptRuns.get(deviceId) ?? [];
    return scriptId ? runs.filter((r) => r.scriptId === scriptId) : runs;
  }

  clearLogs(deviceId: string, scriptId: string) {
    const devMap = this.logs.get(deviceId);
    if (!devMap) return;
    devMap.delete(scriptId);
    if (devMap.size === 0) {
      this.logs.delete(deviceId);
    }
  }

  appendLogs(deviceId: string, scriptId: string, lines: string[], maxTail = 500) {
    const devMap = this.logs.get(deviceId) ?? new Map<string, string[]>();
    const trimmed = lines.length > maxTail ? lines.slice(lines.length - maxTail) : [...lines];
    devMap.set(scriptId, trimmed);
    this.logs.set(deviceId, devMap);

    const runs = this.scriptRuns.get(deviceId) ?? [];
    const lastRun = [...runs].reverse().find((r) => r.scriptId === scriptId);
    if (lastRun) {
      this.appendRunLogs(deviceId, scriptId, lastRun.timestamp, lines, maxTail);
    }
  }

  getLogs(deviceId: string, scriptId: string, lines = 200) {
    const devMap = this.logs.get(deviceId);
    if (!devMap) return [] as string[];
    const arr = devMap.get(scriptId) ?? [];
    if (lines >= arr.length) return [...arr];
    return arr.slice(arr.length - lines);
  }

  appendRunLogs(deviceId: string, scriptId: string, timestamp: number, lines: string[], maxTail = 500) {
    const devMap = this.runLogs.get(deviceId) ?? new Map<string, string[]>();
    const key = this.makeRunKey(scriptId, timestamp);
    const trimmed = lines.length > maxTail ? lines.slice(lines.length - maxTail) : [...lines];
    devMap.set(key, trimmed);
    this.runLogs.set(deviceId, devMap);
  }

  getRunLogs(deviceId: string, scriptId: string, timestamp: number, lines = 200) {
    const devMap = this.runLogs.get(deviceId);
    if (!devMap) return [] as string[];
    const key = this.makeRunKey(scriptId, timestamp);
    const arr = devMap.get(key) ?? [];
    if (lines >= arr.length) return [...arr];
    return arr.slice(arr.length - lines);
  }

  setRemark(deviceId: string, remark: string) {
    const device = this.devices.get(deviceId);
    if (device) {
      device.remark = remark;
    }
    this.remarks.set(deviceId, remark);
    // Async persist
    setRemark(deviceId, remark).catch((err) => {
      console.error('Failed to persist remark for', deviceId, err);
    });
    return true;
  }

  sendToDevice(deviceId: string, message: unknown) {
    const device = this.devices.get(deviceId);
    if (!device || !device.socket || device.socket.readyState !== device.socket.OPEN) {
      if (device && device.status === 'online') {
        this.recordStatus(deviceId, 'offline');
      }
      return { success: false, reason: 'Device offline or socket not ready' };
    }
    device.socket.send(JSON.stringify(message));
    return { success: true };
  }
}

export const deviceStore = new DeviceStore();
