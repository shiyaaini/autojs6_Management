"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceRouter = void 0;
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const deviceStore_1 = require("../store/deviceStore");
const config_1 = require("../config");
const repo_1 = require("../utils/repo");
exports.deviceRouter = (0, express_1.Router)();
const scriptRepo = new repo_1.ScriptRepo(config_1.config.scriptsRepoRoot);
exports.deviceRouter.get('/', (_req, res) => {
    deviceStore_1.deviceStore.checkHeartbeats();
    res.json({ devices: deviceStore_1.deviceStore.getDevices() });
});
exports.deviceRouter.delete('/:deviceId', (req, res) => {
    const ok = deviceStore_1.deviceStore.deleteDevice(req.params.deviceId);
    if (!ok) {
        return res.status(404).json({ message: 'Device not found' });
    }
    return res.json({ message: 'Device deleted' });
});
exports.deviceRouter.get('/:deviceId', (req, res) => {
    const device = deviceStore_1.deviceStore.getDevice(req.params.deviceId);
    if (!device) {
        return res.status(404).json({ message: 'Device not found' });
    }
    return res.json({ device });
});
exports.deviceRouter.get('/:deviceId/status-stats', (req, res) => {
    const { from: fromParam, to: toParam } = req.query;
    const now = Date.now();
    const from = fromParam ? Number.parseInt(fromParam, 10) : now - 24 * 60 * 60 * 1000;
    const to = toParam ? Number.parseInt(toParam, 10) : now;
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
        return res.status(400).json({ message: 'from and to must be valid timestamps' });
    }
    const stats = deviceStore_1.deviceStore.getStatusStats(req.params.deviceId, from, to);
    if (!stats) {
        return res.status(404).json({ message: 'Device not found' });
    }
    return res.json(stats);
});
exports.deviceRouter.post('/:deviceId/remark', (req, res) => {
    const { remark } = req.body;
    const value = (remark ?? '').trim();
    const ok = deviceStore_1.deviceStore.setRemark(req.params.deviceId, value);
    if (!ok) {
        return res.status(404).json({ message: 'Device not found' });
    }
    return res.json({ remark: value });
});
exports.deviceRouter.get('/:deviceId/scripts', (req, res) => {
    const device = deviceStore_1.deviceStore.getDevice(req.params.deviceId);
    if (!device) {
        return res.status(404).json({ message: 'Device not found' });
    }
    return res.json({ scripts: device.scripts });
});
exports.deviceRouter.get('/:deviceId/apps', (req, res) => {
    const device = deviceStore_1.deviceStore.getDeviceRaw(req.params.deviceId);
    if (!device) {
        return res.status(404).json({ message: 'Device not found' });
    }
    return res.json({ apps: device.apps ?? [] });
});
exports.deviceRouter.get('/:deviceId/script-runs', (req, res) => {
    const scriptId = req.query.scriptId;
    const runs = deviceStore_1.deviceStore.getScriptRuns(req.params.deviceId, scriptId);
    return res.json({ runs });
});
exports.deviceRouter.post('/:deviceId/run-script', (req, res) => {
    const { scriptId } = req.body;
    if (!scriptId) {
        return res.status(400).json({ message: 'scriptId is required' });
    }
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, {
        type: 'RUN_SCRIPT',
        payload: { scriptId },
    });
    if (!result.success) {
        return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Command sent' });
});
exports.deviceRouter.post('/:deviceId/request-script-list', (req, res) => {
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, { type: 'REQUEST_SCRIPT_LIST' });
    if (!result.success) {
        return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Request sent' });
});
exports.deviceRouter.post('/:deviceId/request-apps', (req, res) => {
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, { type: 'REQUEST_INSTALLED_APPS' });
    if (!result.success) {
        return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Request sent' });
});
exports.deviceRouter.get('/:deviceId/screenshot', (req, res) => {
    const screenshot = deviceStore_1.deviceStore.getScreenshot(req.params.deviceId);
    return res.json({ screenshot: screenshot ?? null });
});
exports.deviceRouter.post('/:deviceId/request-screenshot', (req, res) => {
    const raw = (req.body ?? {});
    const payload = {};
    if (typeof raw.quality === 'number' && Number.isFinite(raw.quality)) {
        payload.quality = raw.quality;
    }
    if (typeof raw.maxWidth === 'number' && Number.isFinite(raw.maxWidth)) {
        payload.maxWidth = raw.maxWidth;
    }
    if (typeof raw.maxHeight === 'number' && Number.isFinite(raw.maxHeight)) {
        payload.maxHeight = raw.maxHeight;
    }
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, {
        type: 'REQUEST_SCREENSHOT',
        ...(Object.keys(payload).length > 0 ? { payload } : {}),
    });
    if (!result.success) {
        return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Screenshot request sent' });
});
exports.deviceRouter.post('/:deviceId/touch', (req, res) => {
    const payload = req.body;
    if (!payload || !payload.type || !payload.start) {
        return res.status(400).json({ message: 'Invalid touch payload' });
    }
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, {
        type: 'TOUCH_EVENT',
        payload,
    });
    if (!result.success) {
        return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Touch event sent' });
});
exports.deviceRouter.post('/:deviceId/actions', (req, res) => {
    const { action } = req.body;
    if (!action) {
        return res.status(400).json({ message: 'action is required' });
    }
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, {
        type: 'DEVICE_ACTION',
        payload: { action },
    });
    if (!result.success) {
        return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Action sent' });
});
exports.deviceRouter.post('/:deviceId/install-apk', (req, res) => {
    const { apkName, mode } = req.body;
    const trimmed = (apkName ?? '').trim();
    if (!trimmed) {
        return res.status(400).json({ message: 'apkName is required' });
    }
    const apkPath = path_1.default.join(config_1.config.apkRepoRoot, trimmed);
    try {
        if (!fs_1.default.existsSync(apkPath) || !fs_1.default.statSync(apkPath).isFile()) {
            return res.status(404).json({ message: 'APK not found on server' });
        }
    }
    catch (err) {
        console.error('[device] failed to stat apk', apkPath, err);
        return res.status(500).json({ message: 'Failed to access APK on server' });
    }
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, {
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
exports.deviceRouter.post('/:deviceId/push-script', (req, res) => {
    const { path: relPath, runImmediately, scriptId, targetFolder } = req.body;
    if (!relPath) {
        return res.status(400).json({ message: 'path is required' });
    }
    try {
        const { content, item } = scriptRepo.read(relPath);
        const id = scriptId ?? item.path;
        const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, {
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
    }
    catch (err) {
        console.error('[device] push-script failed', relPath, err);
        return res.status(404).json({ message: 'Script not found in repo' });
    }
});
exports.deviceRouter.post('/:deviceId/push-inline-script', (req, res) => {
    const { name, content, runImmediately, targetFolder } = req.body;
    if (!name || typeof content !== 'string') {
        return res.status(400).json({ message: 'name and content are required' });
    }
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, {
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
exports.deviceRouter.post('/:deviceId/create-folder', (req, res) => {
    const { folder } = req.body;
    if (!folder) {
        return res.status(400).json({ message: 'folder is required' });
    }
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, {
        type: 'CREATE_FOLDER',
        payload: { folder },
    });
    if (!result.success) {
        return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Create folder command sent' });
});
exports.deviceRouter.post('/:deviceId/request-running', (req, res) => {
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, { type: 'REQUEST_RUNNING_SCRIPTS' });
    if (!result.success) {
        return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Request sent' });
});
exports.deviceRouter.post('/:deviceId/request-scheduled', (req, res) => {
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, { type: 'REQUEST_SCHEDULED_SCRIPTS' });
    if (!result.success) {
        return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Request sent' });
});
exports.deviceRouter.post('/:deviceId/scheduled-tasks', (req, res) => {
    const { scriptId, mode, timestamp, timeOfDay, daysOfWeek } = req.body;
    if (!scriptId || !mode) {
        return res.status(400).json({ message: 'scriptId and mode are required' });
    }
    if (mode === 'once') {
        if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
            return res.status(400).json({ message: 'timestamp is required for once mode' });
        }
    }
    else if (mode === 'daily') {
        if (!timeOfDay || typeof timeOfDay !== 'string') {
            return res.status(400).json({ message: 'timeOfDay is required for daily mode' });
        }
    }
    else if (mode === 'weekly') {
        if (!timeOfDay || typeof timeOfDay !== 'string') {
            return res.status(400).json({ message: 'timeOfDay is required for weekly mode' });
        }
        if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
            return res.status(400).json({ message: 'daysOfWeek is required for weekly mode' });
        }
    }
    else {
        return res.status(400).json({ message: 'Unsupported mode' });
    }
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, {
        type: 'CREATE_TIMED_TASK',
        payload: { scriptId, mode, timestamp, timeOfDay, daysOfWeek },
    });
    if (!result.success) {
        return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Create timed task command sent' });
});
exports.deviceRouter.post('/:deviceId/broadcast-tasks', (req, res) => {
    const { scriptId, action, local } = req.body;
    if (!scriptId || !action) {
        return res.status(400).json({ message: 'scriptId and action are required' });
    }
    const trimmedScriptId = scriptId.trim();
    const trimmedAction = action.trim();
    if (!trimmedScriptId || !trimmedAction) {
        return res.status(400).json({ message: 'scriptId and action are required' });
    }
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, {
        type: 'CREATE_INTENT_TASK',
        payload: { scriptId: trimmedScriptId, action: trimmedAction, local: !!local },
    });
    if (!result.success) {
        return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Create broadcast task command sent' });
});
exports.deviceRouter.post('/:deviceId/delete-scheduled', (req, res) => {
    const { id } = req.body;
    const trimmed = (id ?? '').trim();
    if (!trimmed) {
        return res.status(400).json({ message: 'id is required' });
    }
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, {
        type: 'DELETE_SCHEDULED_TASK',
        payload: { id: trimmed },
    });
    if (!result.success) {
        return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Delete scheduled task command sent' });
});
exports.deviceRouter.get('/:deviceId/running', (req, res) => {
    const items = deviceStore_1.deviceStore.getRunning(req.params.deviceId);
    return res.json({ items });
});
exports.deviceRouter.get('/:deviceId/scheduled', (req, res) => {
    const items = deviceStore_1.deviceStore.getScheduled(req.params.deviceId);
    return res.json({ items });
});
exports.deviceRouter.post('/:deviceId/request-log', (req, res) => {
    const { scriptId, lines } = req.body;
    if (!scriptId) {
        return res.status(400).json({ message: 'scriptId is required' });
    }
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, {
        type: 'REQUEST_LOG_TAIL',
        payload: { scriptId, lines },
    });
    if (!result.success) {
        return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Request sent' });
});
exports.deviceRouter.get('/:deviceId/logs', (req, res) => {
    const scriptId = req.query.scriptId;
    if (!scriptId) {
        return res.status(400).json({ message: 'scriptId query is required' });
    }
    const linesParam = req.query.lines;
    const lines = linesParam ? Number.parseInt(linesParam, 10) || 200 : 200;
    const result = deviceStore_1.deviceStore.getLogs(req.params.deviceId, scriptId, lines);
    return res.json({ lines: result });
});
exports.deviceRouter.post('/:deviceId/request-script-content', (req, res) => {
    const { scriptId } = req.body;
    if (!scriptId) {
        return res.status(400).json({ message: 'scriptId is required' });
    }
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, {
        type: 'REQUEST_SCRIPT_CONTENT',
        payload: { scriptId },
    });
    if (!result.success) {
        return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Request sent' });
});
exports.deviceRouter.get('/:deviceId/script-content', (req, res) => {
    const scriptId = req.query.scriptId;
    if (!scriptId) {
        return res.status(400).json({ message: 'scriptId query is required' });
    }
    const content = deviceStore_1.deviceStore.getScriptContent(req.params.deviceId, scriptId);
    if (content == null) {
        return res.status(404).json({ message: 'No script content available' });
    }
    return res.json({ content });
});
exports.deviceRouter.post('/:deviceId/update-script-content', (req, res) => {
    const { scriptId, content } = req.body;
    if (!scriptId || typeof content !== 'string') {
        return res.status(400).json({ message: 'scriptId and content are required' });
    }
    const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, {
        type: 'UPDATE_SCRIPT_CONTENT',
        payload: { scriptId, content },
    });
    if (!result.success) {
        return res.status(503).json({ message: result.reason ?? 'Device not available' });
    }
    return res.json({ message: 'Update command sent' });
});
exports.deviceRouter.post('/:deviceId/delete-scripts', (req, res) => {
    const scriptIds = req.body?.scriptIds;
    if (!Array.isArray(scriptIds) || scriptIds.length === 0) {
        return res.status(400).json({ message: 'scriptIds array is required' });
    }
    for (const raw of scriptIds) {
        const scriptId = typeof raw === 'string' ? raw.trim() : '';
        if (!scriptId) {
            continue;
        }
        const result = deviceStore_1.deviceStore.sendToDevice(req.params.deviceId, {
            type: 'DELETE_SCRIPT',
            payload: { scriptId },
        });
        if (!result.success) {
            return res.status(503).json({ message: result.reason ?? 'Device not available' });
        }
    }
    return res.json({ message: 'Delete commands sent' });
});
exports.deviceRouter.get('/:deviceId/run-logs', (req, res) => {
    const scriptId = req.query.scriptId;
    const tsParam = req.query.timestamp;
    if (!scriptId || !tsParam) {
        return res.status(400).json({ message: 'scriptId and timestamp query are required' });
    }
    const timestamp = Number.parseInt(tsParam, 10);
    if (Number.isNaN(timestamp)) {
        return res.status(400).json({ message: 'timestamp must be a number' });
    }
    const linesParam = req.query.lines;
    const lines = linesParam ? Number.parseInt(linesParam, 10) || 200 : 200;
    const result = deviceStore_1.deviceStore.getRunLogs(req.params.deviceId, scriptId, timestamp, lines);
    return res.json({ lines: result });
});
