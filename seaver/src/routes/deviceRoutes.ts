import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { deviceStore } from '../store/deviceStore';
import type { TouchEventPayload, DeviceAction } from '../types';
import { config } from '../config';
import { ScriptRepo } from '../utils/repo';

export const deviceRouter = Router();

const scriptRepo = new ScriptRepo(config.scriptsRepoRoot);

deviceRouter.get('/', (_req, res) => {
  deviceStore.checkHeartbeats();
  res.json({ devices: deviceStore.getDevices() });
});

deviceRouter.delete('/:deviceId', (req, res) => {
  const ok = deviceStore.deleteDevice(req.params.deviceId);
  if (!ok) {
    return res.status(404).json({ message: 'Device not found' });
  }
  return res.json({ message: 'Device deleted' });
});

deviceRouter.get('/:deviceId', (req, res) => {
  const device = deviceStore.getDevice(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ message: 'Device not found' });
  }
  return res.json({ device });
});

deviceRouter.get('/:deviceId/status-stats', (req, res) => {
  const { from: fromParam, to: toParam } = req.query as { from?: string; to?: string };
  const now = Date.now();
  const from = fromParam ? Number.parseInt(fromParam, 10) : now - 24 * 60 * 60 * 1000;
  const to = toParam ? Number.parseInt(toParam, 10) : now;

  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return res.status(400).json({ message: 'from and to must be valid timestamps' });
  }

  const stats = deviceStore.getStatusStats(req.params.deviceId, from, to);
  if (!stats) {
    return res.status(404).json({ message: 'Device not found' });
  }

  return res.json(stats);
});

deviceRouter.post('/:deviceId/remark', (req, res) => {
  const { remark } = req.body as { remark?: string };
  const value = (remark ?? '').trim();
  const ok = deviceStore.setRemark(req.params.deviceId, value);
  if (!ok) {
    return res.status(404).json({ message: 'Device not found' });
  }
  return res.json({ remark: value });
});

deviceRouter.get('/:deviceId/scripts', (req, res) => {
  const device = deviceStore.getDevice(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ message: 'Device not found' });
  }
  return res.json({ scripts: device.scripts });
});

deviceRouter.get('/:deviceId/apps', (req, res) => {
  const device = deviceStore.getDeviceRaw(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ message: 'Device not found' });
  }
  return res.json({ apps: device.apps ?? [] });
});

deviceRouter.get('/:deviceId/script-runs', (req, res) => {
  const scriptId = req.query.scriptId as string | undefined;
  const runs = deviceStore.getScriptRuns(req.params.deviceId, scriptId);
  return res.json({ runs });
});

deviceRouter.post('/:deviceId/run-script', (req, res) => {
  const { scriptId } = req.body as { scriptId?: string };
  if (!scriptId) {
    return res.status(400).json({ message: 'scriptId is required' });
  }
  const result = deviceStore.sendToDevice(req.params.deviceId, {
    type: 'RUN_SCRIPT',
    payload: { scriptId },
  });
  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }
  return res.json({ message: 'Command sent' });
});

deviceRouter.post('/:deviceId/request-script-list', (req, res) => {
  const result = deviceStore.sendToDevice(req.params.deviceId, { type: 'REQUEST_SCRIPT_LIST' });
  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }
  return res.json({ message: 'Request sent' });
});

deviceRouter.post('/:deviceId/request-apps', (req, res) => {
  const result = deviceStore.sendToDevice(req.params.deviceId, { type: 'REQUEST_INSTALLED_APPS' });
  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }
  return res.json({ message: 'Request sent' });
});

deviceRouter.get('/:deviceId/screenshot', (req, res) => {
  const screenshot = deviceStore.getScreenshot(req.params.deviceId);
  return res.json({ screenshot: screenshot ?? null });
});

deviceRouter.post('/:deviceId/request-screenshot', (req, res) => {
  const raw = (req.body ?? {}) as { quality?: unknown; maxWidth?: unknown; maxHeight?: unknown };
  const payload: { quality?: number; maxWidth?: number; maxHeight?: number } = {};
  if (typeof raw.quality === 'number' && Number.isFinite(raw.quality)) {
    payload.quality = raw.quality;
  }
  if (typeof raw.maxWidth === 'number' && Number.isFinite(raw.maxWidth)) {
    payload.maxWidth = raw.maxWidth;
  }
  if (typeof raw.maxHeight === 'number' && Number.isFinite(raw.maxHeight)) {
    payload.maxHeight = raw.maxHeight;
  }
  const result = deviceStore.sendToDevice(req.params.deviceId, {
    type: 'REQUEST_SCREENSHOT',
    ...(Object.keys(payload).length > 0 ? { payload } : {}),
  });
  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }
  return res.json({ message: 'Screenshot request sent' });
});

deviceRouter.post('/:deviceId/touch', (req, res) => {
  const payload = req.body as TouchEventPayload;
  if (!payload || !payload.type || !payload.start) {
    return res.status(400).json({ message: 'Invalid touch payload' });
  }
  const result = deviceStore.sendToDevice(req.params.deviceId, {
    type: 'TOUCH_EVENT',
    payload,
  });
  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }
  return res.json({ message: 'Touch event sent' });
});

deviceRouter.post('/:deviceId/actions', (req, res) => {
  const { action } = req.body as { action?: DeviceAction };
  if (!action) {
    return res.status(400).json({ message: 'action is required' });
  }

  const result = deviceStore.sendToDevice(req.params.deviceId, {
    type: 'DEVICE_ACTION',
    payload: { action },
  });
  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }
  return res.json({ message: 'Action sent' });
});

deviceRouter.post('/:deviceId/install-apk', (req, res) => {
  const { apkName, mode } = req.body as { apkName?: string; mode?: 'auto' | 'normal' | 'root' };
  const trimmed = (apkName ?? '').trim();
  if (!trimmed) {
    return res.status(400).json({ message: 'apkName is required' });
  }

  const apkPath = path.join(config.apkRepoRoot, trimmed);
  try {
    if (!fs.existsSync(apkPath) || !fs.statSync(apkPath).isFile()) {
      return res.status(404).json({ message: 'APK not found on server' });
    }
  } catch (err) {
    console.error('[device] failed to stat apk', apkPath, err);
    return res.status(500).json({ message: 'Failed to access APK on server' });
  }

  const result = deviceStore.sendToDevice(req.params.deviceId, {
    type: 'INSTALL_APK',
    payload: {
      apkName: trimmed,
      ...(mode ? { mode } : {}),
    },
  });
  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }
  return res.json({ message: 'Install APK command sent' });
});

deviceRouter.post('/:deviceId/push-script', (req, res) => {
  const { path: relPath, runImmediately, scriptId, targetFolder } = req.body as {
    path?: string;
    runImmediately?: boolean;
    scriptId?: string;
    targetFolder?: string;
  };
  if (!relPath) {
    return res.status(400).json({ message: 'path is required' });
  }
  try {
    const { content, item } = scriptRepo.read(relPath);
    const id = scriptId ?? item.path;
    const result = deviceStore.sendToDevice(req.params.deviceId, {
      type: 'PUSH_SCRIPT',
      payload: {
        scriptId: id,
        name: item.name,
        content,
        runImmediately: !!runImmediately,
        targetFolder,
      },
    });
    if (!result.success) {
      return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Script push command sent', scriptId: id });
  } catch (err) {
    console.error('[device] push-script failed', relPath, err);
    return res.status(404).json({ message: 'Script not found in repo' });
  }
});

deviceRouter.post('/:deviceId/push-inline-script', (req, res) => {
  const { name, content, runImmediately, targetFolder } = req.body as {
    name?: string;
    content?: string;
    runImmediately?: boolean;
    targetFolder?: string;
  };
  if (!name || typeof content !== 'string') {
    return res.status(400).json({ message: 'name and content are required' });
  }
  const result = deviceStore.sendToDevice(req.params.deviceId, {
    type: 'PUSH_SCRIPT',
    payload: {
      scriptId: name,
      name,
      content,
      runImmediately: !!runImmediately,
      targetFolder,
    },
  });
  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }
  return res.json({ message: 'Inline script push command sent' });
});

deviceRouter.post('/:deviceId/create-folder', (req, res) => {
  const { folder } = req.body as { folder?: string };
  if (!folder) {
    return res.status(400).json({ message: 'folder is required' });
  }
  const result = deviceStore.sendToDevice(req.params.deviceId, {
    type: 'CREATE_FOLDER',
    payload: { folder },
  });
  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }
  return res.json({ message: 'Create folder command sent' });
});


deviceRouter.post('/:deviceId/request-running', (req, res) => {
  const result = deviceStore.sendToDevice(req.params.deviceId, { type: 'REQUEST_RUNNING_SCRIPTS' });
  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }
  return res.json({ message: 'Request sent' });
});

deviceRouter.post('/:deviceId/request-scheduled', (req, res) => {
  const result = deviceStore.sendToDevice(req.params.deviceId, { type: 'REQUEST_SCHEDULED_SCRIPTS' });
  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }
  return res.json({ message: 'Request sent' });
});

deviceRouter.post('/:deviceId/scheduled-tasks', (req, res) => {
  const { scriptId, mode, timestamp, timeOfDay, daysOfWeek } = req.body as {
    scriptId?: string;
    mode?: 'once' | 'daily' | 'weekly';
    timestamp?: number;
    timeOfDay?: string;
    daysOfWeek?: number[];
  };

  if (!scriptId || !mode) {
    return res.status(400).json({ message: 'scriptId and mode are required' });
  }

  if (mode === 'once') {
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
      return res.status(400).json({ message: 'timestamp is required for once mode' });
    }
  } else if (mode === 'daily') {
    if (!timeOfDay || typeof timeOfDay !== 'string') {
      return res.status(400).json({ message: 'timeOfDay is required for daily mode' });
    }
  } else if (mode === 'weekly') {
    if (!timeOfDay || typeof timeOfDay !== 'string') {
      return res.status(400).json({ message: 'timeOfDay is required for weekly mode' });
    }
    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return res.status(400).json({ message: 'daysOfWeek is required for weekly mode' });
    }
  } else {
    return res.status(400).json({ message: 'Unsupported mode' });
  }

  const result = deviceStore.sendToDevice(req.params.deviceId, {
    type: 'CREATE_TIMED_TASK',
    payload: { scriptId, mode, timestamp, timeOfDay, daysOfWeek },
  });

  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }

  return res.json({ message: 'Create timed task command sent' });
});

deviceRouter.post('/:deviceId/broadcast-tasks', (req, res) => {
  const { scriptId, action, local } = req.body as { scriptId?: string; action?: string; local?: boolean };

  if (!scriptId || !action) {
    return res.status(400).json({ message: 'scriptId and action are required' });
  }

  const trimmedScriptId = scriptId.trim();
  const trimmedAction = action.trim();
  if (!trimmedScriptId || !trimmedAction) {
    return res.status(400).json({ message: 'scriptId and action are required' });
  }

  const result = deviceStore.sendToDevice(req.params.deviceId, {
    type: 'CREATE_INTENT_TASK',
    payload: { scriptId: trimmedScriptId, action: trimmedAction, local: !!local },
  });

  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }

  return res.json({ message: 'Create broadcast task command sent' });
});

deviceRouter.post('/:deviceId/delete-scheduled', (req, res) => {
  const { id } = req.body as { id?: string };
  const trimmed = (id ?? '').trim();
  if (!trimmed) {
    return res.status(400).json({ message: 'id is required' });
  }

  const result = deviceStore.sendToDevice(req.params.deviceId, {
    type: 'DELETE_SCHEDULED_TASK',
    payload: { id: trimmed },
  });

  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }

  return res.json({ message: 'Delete scheduled task command sent' });
});

deviceRouter.get('/:deviceId/running', (req, res) => {
  const items = deviceStore.getRunning(req.params.deviceId);
  return res.json({ items });
});

deviceRouter.get('/:deviceId/scheduled', (req, res) => {
  const items = deviceStore.getScheduled(req.params.deviceId);
  return res.json({ items });
});

deviceRouter.post('/:deviceId/request-log', (req, res) => {
  const { scriptId, lines } = req.body as { scriptId?: string; lines?: number };
  if (!scriptId) {
    return res.status(400).json({ message: 'scriptId is required' });
  }
  const result = deviceStore.sendToDevice(req.params.deviceId, {
    type: 'REQUEST_LOG_TAIL',
    payload: { scriptId, lines },
  });
  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }
  return res.json({ message: 'Request sent' });
});

deviceRouter.get('/:deviceId/logs', (req, res) => {
  const scriptId = req.query.scriptId as string | undefined;
  if (!scriptId) {
    return res.status(400).json({ message: 'scriptId query is required' });
  }
  const linesParam = req.query.lines as string | undefined;
  const lines = linesParam ? Number.parseInt(linesParam, 10) || 200 : 200;
  const result = deviceStore.getLogs(req.params.deviceId, scriptId, lines);
  return res.json({ lines: result });
});

deviceRouter.post('/:deviceId/request-script-content', (req, res) => {
  const { scriptId } = req.body as { scriptId?: string };
  if (!scriptId) {
    return res.status(400).json({ message: 'scriptId is required' });
  }
  const result = deviceStore.sendToDevice(req.params.deviceId, {
    type: 'REQUEST_SCRIPT_CONTENT',
    payload: { scriptId },
  });
  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }
  return res.json({ message: 'Request sent' });
});

deviceRouter.get('/:deviceId/script-content', (req, res) => {
  const scriptId = req.query.scriptId as string | undefined;
  if (!scriptId) {
    return res.status(400).json({ message: 'scriptId query is required' });
  }
  const content = deviceStore.getScriptContent(req.params.deviceId, scriptId);
  if (content == null) {
    return res.status(404).json({ message: 'No script content available' });
  }
  return res.json({ content });
});

deviceRouter.post('/:deviceId/update-script-content', (req, res) => {
  const { scriptId, content } = req.body as { scriptId?: string; content?: string };
  if (!scriptId || typeof content !== 'string') {
    return res.status(400).json({ message: 'scriptId and content are required' });
  }
  const result = deviceStore.sendToDevice(req.params.deviceId, {
    type: 'UPDATE_SCRIPT_CONTENT',
    payload: { scriptId, content },
  });
  if (!result.success) {
    return res.status(503).json({ message: result.reason ?? 'Device not available' });
  }
  return res.json({ message: 'Update command sent' });
});

deviceRouter.post('/:deviceId/delete-scripts', (req, res) => {
  const scriptIds = req.body?.scriptIds as unknown;
  if (!Array.isArray(scriptIds) || scriptIds.length === 0) {
    return res.status(400).json({ message: 'scriptIds array is required' });
  }

  for (const raw of scriptIds) {
    const scriptId = typeof raw === 'string' ? raw.trim() : '';
    if (!scriptId) {
      continue;
    }
    const result = deviceStore.sendToDevice(req.params.deviceId, {
      type: 'DELETE_SCRIPT',
      payload: { scriptId },
    });
    if (!result.success) {
      return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
  }

  return res.json({ message: 'Delete commands sent' });
});

deviceRouter.get('/:deviceId/run-logs', (req, res) => {
  const scriptId = req.query.scriptId as string | undefined;
  const tsParam = req.query.timestamp as string | undefined;
  if (!scriptId || !tsParam) {
    return res.status(400).json({ message: 'scriptId and timestamp query are required' });
  }
  const timestamp = Number.parseInt(tsParam, 10);
  if (Number.isNaN(timestamp)) {
    return res.status(400).json({ message: 'timestamp must be a number' });
  }
  const linesParam = req.query.lines as string | undefined;
  const lines = linesParam ? Number.parseInt(linesParam, 10) || 200 : 200;
  const result = deviceStore.getRunLogs(req.params.deviceId, scriptId, timestamp, lines);
  return res.json({ lines: result });
});
