"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ws_1 = require("ws");
const config_1 = require("./config");
const deviceRoutes_1 = require("./routes/deviceRoutes");
const configRoutes_1 = require("./routes/configRoutes");
const repoRoutes_1 = require("./routes/repoRoutes");
const apkRoutes_1 = require("./routes/apkRoutes");
const authRoutes_1 = require("./routes/authRoutes");
const deviceStore_1 = require("./store/deviceStore");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: config_1.config.corsOrigin }));
app.use(express_1.default.json({ limit: '10mb' }));
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});
app.use('/api/devices', deviceRoutes_1.deviceRouter);
app.use('/api/config', configRoutes_1.configRouter);
app.use('/api/repo', repoRoutes_1.repoRouter);
app.use('/api/apk', apkRoutes_1.apkRouter);
app.use('/api/auth', authRoutes_1.authRouter);
const server = http_1.default.createServer(app);
const wss = new ws_1.WebSocketServer({ server, path: '/ws/device' });
wss.on('connection', (socket, req) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    const deviceId = url.searchParams.get('deviceId');
    if (!deviceId) {
        socket.close(1008, 'deviceId query param required');
        return;
    }
    const matchCode = url.searchParams.get('matchCode');
    if (config_1.config.matchCode && matchCode !== config_1.config.matchCode) {
        socket.close(1008, 'invalid matchCode');
        return;
    }
    const mode = url.searchParams.get('mode');
    const isTest = mode === 'test';
    if (isTest) {
        console.log(`[WS] Test connection from device: ${deviceId}`);
        socket.on('close', () => {
            console.log(`[WS] Test connection closed: ${deviceId}`);
        });
        socket.on('error', (err) => {
            console.error(`[WS] Error on test connection ${deviceId}:`, err);
        });
        return;
    }
    console.log(`[WS] Device connected: ${deviceId}`);
    deviceStore_1.deviceStore.attachSocket(deviceId, socket);
    socket.on('message', (raw) => {
        try {
            const data = typeof raw === 'string' ? raw : raw.toString('utf-8');
            const message = JSON.parse(data);
            handleDeviceMessage(deviceId, socket, message);
        }
        catch (err) {
            console.error(`[WS] Failed to handle message from ${deviceId}:`, err);
        }
    });
    socket.on('close', (code, reason) => {
        const reasonText = typeof reason === 'string' ? reason : reason?.toString() || '';
        console.log(`[WS] Device disconnected: ${deviceId} code=${code} reason=${reasonText}`);
        deviceStore_1.deviceStore.detachSocket(deviceId);
    });
    socket.on('error', (err) => {
        console.error(`[WS] Error on device ${deviceId} socket:`, err);
        deviceStore_1.deviceStore.markOffline(socket);
    });
});
function handleDeviceMessage(deviceId, socket, message) {
    switch (message.type) {
        case 'DEVICE_INFO': {
            const payload = message.payload;
            deviceStore_1.deviceStore.upsertDevice({ ...payload, deviceId }, socket);
            break;
        }
        case 'HEARTBEAT': {
            const { timestamp, ...rest } = message.payload;
            // 使用 WebSocket 连接 URL 中解析出来的 deviceId，而不是依赖客户端 payload 里的字段
            deviceStore_1.deviceStore.updateHeartbeat(deviceId, rest);
            break;
        }
        case 'SCRIPT_LIST': {
            deviceStore_1.deviceStore.updateScripts(deviceId, message.payload.scripts, message.payload.folders);
            break;
        }
        case 'SCRIPT_STATUS_UPDATE': {
            const { scriptId, status, detail } = message.payload;
            const run = deviceStore_1.deviceStore.recordScriptStatus(deviceId, scriptId, status, detail);
            // 对于结束状态（success / error），自动向设备请求一次日志尾部，作为该次运行的快照
            if (status && status !== 'running' && scriptId) {
                const snapshotRequest = {
                    type: 'REQUEST_LOG_TAIL',
                    payload: { scriptId, lines: 500 },
                };
                try {
                    socket.send(JSON.stringify(snapshotRequest));
                    console.log(`[WS] Requested log tail snapshot for ${deviceId} ${scriptId} at ${run.timestamp}`);
                }
                catch (err) {
                    console.error(`[WS] Failed to request log tail snapshot for ${deviceId}:`, err);
                }
            }
            break;
        }
        case 'SCREENSHOT': {
            deviceStore_1.deviceStore.updateScreenshot(deviceId, message.payload);
            break;
        }
        case 'RUNNING_SCRIPTS': {
            deviceStore_1.deviceStore.updateRunning(deviceId, message.payload.items);
            break;
        }
        case 'SCHEDULED_SCRIPTS': {
            deviceStore_1.deviceStore.updateScheduled(deviceId, message.payload.items);
            break;
        }
        case 'INSTALLED_APPS': {
            deviceStore_1.deviceStore.updateApps(deviceId, message.payload.apps);
            break;
        }
        case 'LOG_LINES': {
            const { scriptId, lines } = message.payload;
            deviceStore_1.deviceStore.appendLogs(deviceId, scriptId, lines);
            break;
        }
        case 'SCRIPT_CONTENT': {
            const { scriptId, content } = message.payload;
            deviceStore_1.deviceStore.setScriptContent(deviceId, scriptId, content);
            break;
        }
        default: {
            console.warn(`[WS] Unknown message type from ${deviceId}:`, message);
        }
    }
}
server.listen(config_1.config.port, () => {
    console.log(`Server listening on port ${config_1.config.port}`);
});
