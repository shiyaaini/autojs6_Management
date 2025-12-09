import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { config } from './config';
import { deviceRouter } from './routes/deviceRoutes';
import { configRouter } from './routes/configRoutes';
import { repoRouter } from './routes/repoRoutes';
import { apkRouter } from './routes/apkRoutes';
import { authRouter } from './routes/authRoutes';
import { deviceStore } from './store/deviceStore';
import type { DeviceToServerMessage, DeviceInfoPayload } from './types';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api/devices', deviceRouter);
app.use('/api/config', configRouter);
app.use('/api/repo', repoRouter);
app.use('/api/apk', apkRouter);
app.use('/api/auth', authRouter);

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws/device' });

wss.on('connection', (socket: WebSocket, req) => {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const deviceId = url.searchParams.get('deviceId');
  if (!deviceId) {
    socket.close(1008, 'deviceId query param required');
    return;
  }

  const matchCode = url.searchParams.get('matchCode');
  if (config.matchCode && matchCode !== config.matchCode) {
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
  deviceStore.attachSocket(deviceId, socket);

  socket.on('message', (raw) => {
    try {
      const data = typeof raw === 'string' ? raw : raw.toString('utf-8');
      const message = JSON.parse(data) as DeviceToServerMessage;
      handleDeviceMessage(deviceId, socket, message);
    } catch (err) {
      console.error(`[WS] Failed to handle message from ${deviceId}:`, err);
    }
  });

  socket.on('close', (code, reason) => {
    const reasonText = typeof reason === 'string' ? reason : reason?.toString() || '';
    console.log(`[WS] Device disconnected: ${deviceId} code=${code} reason=${reasonText}`);
    deviceStore.detachSocket(deviceId);
  });

  socket.on('error', (err) => {
    console.error(`[WS] Error on device ${deviceId} socket:`, err);
    deviceStore.markOffline(socket);
  });
});

function handleDeviceMessage(deviceId: string, socket: WebSocket, message: DeviceToServerMessage) {
  switch (message.type) {
    case 'DEVICE_INFO': {
      const payload: DeviceInfoPayload = message.payload;
      deviceStore.upsertDevice({ ...payload, deviceId }, socket);
      break;
    }
    case 'HEARTBEAT': {
      const { timestamp, ...rest } = message.payload;
      // 使用 WebSocket 连接 URL 中解析出来的 deviceId，而不是依赖客户端 payload 里的字段
      deviceStore.updateHeartbeat(deviceId, rest);
      break;
    }
    case 'SCRIPT_LIST': {
      deviceStore.updateScripts(deviceId, message.payload.scripts, message.payload.folders);
      break;
    }
    case 'SCRIPT_STATUS_UPDATE': {
      const { scriptId, status, detail } = message.payload;
      const run = deviceStore.recordScriptStatus(deviceId, scriptId, status, detail);
      // 对于结束状态（success / error），自动向设备请求一次日志尾部，作为该次运行的快照
      if (status && status !== 'running' && scriptId) {
        const snapshotRequest = {
          type: 'REQUEST_LOG_TAIL',
          payload: { scriptId, lines: 500 },
        };
        try {
          socket.send(JSON.stringify(snapshotRequest));
          console.log(`[WS] Requested log tail snapshot for ${deviceId} ${scriptId} at ${run.timestamp}`);
        } catch (err) {
          console.error(`[WS] Failed to request log tail snapshot for ${deviceId}:`, err);
        }
      }
      break;
    }
    case 'SCREENSHOT': {
      deviceStore.updateScreenshot(deviceId, message.payload);
      break;
    }
    case 'RUNNING_SCRIPTS': {
      deviceStore.updateRunning(deviceId, message.payload.items);
      break;
    }
    case 'SCHEDULED_SCRIPTS': {
      deviceStore.updateScheduled(deviceId, message.payload.items);
      break;
    }
    case 'INSTALLED_APPS': {
      deviceStore.updateApps(deviceId, message.payload.apps);
      break;
    }
    case 'LOG_LINES': {
      const { scriptId, lines } = message.payload;
      deviceStore.appendLogs(deviceId, scriptId, lines);
      break;
    }
    case 'SCRIPT_CONTENT': {
      const { scriptId, content } = message.payload;
      deviceStore.setScriptContent(deviceId, scriptId, content);
      break;
    }
    default: {
      console.warn(`[WS] Unknown message type from ${deviceId}:`, message);
    }
  }
}

server.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
