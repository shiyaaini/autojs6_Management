import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, Space, Button, Tag, Empty, Alert, message, Select, Input, Modal, FloatButton } from 'antd'
import {
  ReloadOutlined,
  VideoCameraOutlined,
  ArrowLeftOutlined,
  SendOutlined,
  ExpandAltOutlined,
  CloseOutlined,
  MenuOutlined,
  HomeOutlined,
  AppstoreOutlined,
  NotificationOutlined,
  BulbOutlined,
  BulbFilled,
  AudioMutedOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams, Link } from 'react-router-dom'
import type { ScreenshotPayload, TouchEventPayload, ScriptSummary } from '../types'
import {
  fetchScreenshot,
  requestScreenshot,
  sendTouchEvent,
  fetchDeviceScripts,
  runDeviceScript,
  pushInlineScriptToDevice,
} from '../api/devices'

const SWIPE_DISTANCE_THRESHOLD = 50
const LONG_PRESS_THRESHOLD_MS = 700
const LONG_PRESS_MOVE_TOLERANCE = 18

const AUTO_REFRESH_OPTIONS: { label: string; value: number }[] = [
  { label: '自动刷新：关闭', value: 0 },
  { label: '自动刷新：0.6 秒', value: 600 },
  { label: '自动刷新：1 秒', value: 1000 },
  { label: '自动刷新：2 秒', value: 2000 },
  { label: '自动刷新：5 秒', value: 5000 },
]

const SCREENSHOT_QUALITY_OPTIONS: { label: string; value: number }[] = [
  { label: '清晰度：省流量', value: 40 },
  { label: '清晰度：标准', value: 60 },
  { label: '清晰度：高清', value: 80 },
]

type ScreenshotResolutionValue = 'low' | 'medium' | 'high' | 'original'

const SCREENSHOT_RESOLUTION_OPTIONS: { label: string; value: ScreenshotResolutionValue }[] = [
  { label: '分辨率：省资源（最长边 720）', value: 'low' },
  { label: '分辨率：标准（最长边 1080）', value: 'medium' },
  { label: '分辨率：高清（最长边 1440）', value: 'high' },
  { label: '分辨率：原始（不缩放）', value: 'original' },
]

const REMOTE_SCREEN_SETTINGS_KEY = 'autojs6_screen_wall_settings'

function getResolutionLimit(value: ScreenshotResolutionValue): { maxWidth?: number; maxHeight?: number } {
  switch (value) {
    case 'low':
      return { maxWidth: 720, maxHeight: 720 }
    case 'medium':
      return { maxWidth: 1080, maxHeight: 1080 }
    case 'high':
      return { maxWidth: 1440, maxHeight: 1440 }
    case 'original':
    default:
      return {}
  }
}

const gestureLabelMap: Record<TouchEventPayload['type'], string> = {
  tap: '点击',
  swipe: '滑动',
  long_press: '长按',
}

const SCALE_OPTIONS = [
  { label: '画面缩放：50%', value: 0.5 },
  { label: '画面缩放：75%', value: 0.75 },
  { label: '画面缩放：100%', value: 1 },
  { label: '画面缩放：125%', value: 1.25 },
]

const REMOTE_SCRIPTS = {
  back: {
    id: '__mgmt_remote_back__.js',
    content: 'back();\n',
  },
  home: {
    id: '__mgmt_remote_home__.js',
    content: 'home();\n',
  },
  recents: {
    id: '__mgmt_remote_recents__.js',
    content: 'recents();\n',
  },
  notifications: {
    id: '__mgmt_remote_notifications__.js',
    content: 'notifications();\n',
  },
  screenOn: {
    id: '__mgmt_remote_screen_on__.js',
    content:
      'if ((typeof isScreenOn === "function" && !isScreenOn()) || ' +
      '(!this.isScreenOn && device.isScreenOff && device.isScreenOff())) {\n' +
      '  if (device.wakeUp) { device.wakeUp(); }\n' +
      '}\n',
  },
  screenOff: {
    id: '__mgmt_remote_screen_off__.js',
    content:
      'if (typeof automator !== "undefined" && automator.lockScreen) {\n' +
      '  automator.lockScreen();\n' +
      '}\n',
  },
  volumeUp: {
    id: '__mgmt_remote_volume_up__.js',
    content:
      'var v = device.getMusicVolume();\n' +
      'var max = device.getMusicMaxVolume();\n' +
      'var nv = v + 10;\n' +
      'if (nv > max) nv = max;\n' +
      'device.setMusicVolume(nv);\n',
  },
  volumeDown: {
    id: '__mgmt_remote_volume_down__.js',
    content:
      'var v = device.getMusicVolume();\n' +
      'var nv = v - 10;\n' +
      'if (nv < 0) nv = 0;\n' +
      'device.setMusicVolume(nv);\n',
  },
  mute: {
    id: '__mgmt_remote_mute__.js',
    content: 'device.setMusicVolume(0);\n',
  },
} as const

interface PointerInfo {
  pointerId: number
  startDevice: { x: number; y: number }
  lastDevice: { x: number; y: number }
  startView: { x: number; y: number }
  startTime: number
}

export function RemoteControlPage() {
  const { deviceId } = useParams<{ deviceId: string }>()
  const navigate = useNavigate()

  const [remoteScreenshot, setRemoteScreenshot] = useState<ScreenshotPayload | null>(null)
  const [screenshotLoading, setScreenshotLoading] = useState(false)
  const [requestingScreenshot, setRequestingScreenshot] = useState(false)
  const [lastGesture, setLastGesture] = useState<string | null>(null)
  const [autoRefreshMs, setAutoRefreshMs] = useState<number>(1000)
  const [screenshotQuality, setScreenshotQuality] = useState<number>(80)
  const [screenshotResolution, setScreenshotResolution] = useState<ScreenshotResolutionValue>('medium')
  const [scale, setScale] = useState<number>(0.75)
  const [inputText, setInputText] = useState('')
  const [sendingText, setSendingText] = useState(false)
  const [zoomModalVisible, setZoomModalVisible] = useState(false)
  const pointerInfoRef = useRef<PointerInfo | null>(null)
  const [deviceScripts, setDeviceScripts] = useState<ScriptSummary[] | null>(null)
  const settingsLoadedRef = useRef(false)

  const handleSendText = useCallback(async () => {
    if (!deviceId) return
    if (!inputText) {
      message.warning('请输入要发送的文本')
      return
    }
    setSendingText(true)
    try {
      // 构造逐字输入的脚本
      // 简单的 Text(str) 可能会一次性输入，有些输入框可能不支持
      // 这里使用 Text(str) 即可，因为 AutoJs6 的 Text() 函数通常是模拟输入文本
      const scriptContent = `Text(${JSON.stringify(inputText)});\n`
      await pushInlineScriptToDevice(deviceId, {
        name: 'remote_input.js',
        content: scriptContent,
        runImmediately: true,
      })
      message.success('已发送输入指令')
      setInputText('')
    } catch (err) {
      console.error(err)
      message.error('发送文本失败')
    } finally {
      setSendingText(false)
    }
  }, [deviceId, inputText])

  const loadScreenshot = useCallback(async () => {
    if (!deviceId) return
    setScreenshotLoading(true)
    try {
      const shot = await fetchScreenshot(deviceId)
      setRemoteScreenshot(shot)
    } catch (err) {
      console.error(err)
      message.error('获取截图失败')
    } finally {
      setScreenshotLoading(false)
    }
  }, [deviceId, screenshotQuality])

  const handleRequestScreenshot = useCallback(async () => {
    if (!deviceId) return
    setRequestingScreenshot(true)
    try {
      const { maxWidth, maxHeight } = getResolutionLimit(screenshotResolution)
      await requestScreenshot(deviceId, {
        quality: screenshotQuality,
        ...(typeof maxWidth === 'number' ? { maxWidth } : {}),
        ...(typeof maxHeight === 'number' ? { maxHeight } : {}),
      })
      message.success('已请求设备上传最新截图')
      const maxAttempts = 5
      let received = false
      for (let i = 0; i < maxAttempts; i += 1) {
        // 间隔 1 秒轮询最新截图，避免设备响应稍有延迟时总是拿到 null
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 1000)
        })
        // eslint-disable-next-line no-await-in-loop
        const shot = await fetchScreenshot(deviceId)
        if (shot) {
          setRemoteScreenshot(shot)
          received = true
          break
        }
      }
      if (!received) {
        message.warning('设备暂未返回截图，可稍后点击“刷新截图”重试')
      }
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('503') && msg.includes('Device offline or socket not ready')) {
        message.error('设备当前离线或未建立控制连接（WebSocket 未就绪），请检查设备上的管理平台连接后重试')
      } else {
        message.error('请求设备截图失败')
      }
    } finally {
      setRequestingScreenshot(false)
    }
  }, [deviceId, screenshotQuality, screenshotResolution])

  const refreshOnceSilently = useCallback(async () => {
    if (!deviceId) return
    try {
      const { maxWidth, maxHeight } = getResolutionLimit(screenshotResolution)
      await requestScreenshot(deviceId, {
        quality: screenshotQuality,
        ...(typeof maxWidth === 'number' ? { maxWidth } : {}),
        ...(typeof maxHeight === 'number' ? { maxHeight } : {}),
      })
      const shot = await fetchScreenshot(deviceId)
      if (shot) {
        setRemoteScreenshot(shot)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('503') && msg.includes('Device offline or socket not ready')) {
        // 静默忽略设备离线导致的错误，避免控制台反复报错
        return
      }
      console.error(err)
    }
  }, [deviceId, screenshotQuality, screenshotResolution])

  const convertPointerToDevice = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!remoteScreenshot) return null
      const rect = event.currentTarget.getBoundingClientRect()
      const offsetX = event.clientX - rect.left
      const offsetY = event.clientY - rect.top
      if (offsetX < 0 || offsetY < 0 || offsetX > rect.width || offsetY > rect.height) {
        return null
      }
      const width = remoteScreenshot.width ?? rect.width
      const height = remoteScreenshot.height ?? rect.height
      const deviceX = Math.round((offsetX / rect.width) * width)
      const deviceY = Math.round((offsetY / rect.height) * height)
      return {
        device: { x: deviceX, y: deviceY },
        view: { x: offsetX, y: offsetY },
      }
    },
    [remoteScreenshot],
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!deviceId || !remoteScreenshot) return
      event.currentTarget.setPointerCapture(event.pointerId)
      const coords = convertPointerToDevice(event)
      if (!coords) return
      pointerInfoRef.current = {
        pointerId: event.pointerId,
        startDevice: coords.device,
        lastDevice: coords.device,
        startView: coords.view,
        startTime: Date.now(),
      }
    },
    [convertPointerToDevice, deviceId, remoteScreenshot],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const info = pointerInfoRef.current
      if (!info || info.pointerId !== event.pointerId) return
      const coords = convertPointerToDevice(event)
      if (!coords) return
      pointerInfoRef.current = { ...info, lastDevice: coords.device }
    },
    [convertPointerToDevice],
  )

  const concludeGesture = useCallback(
    async (info: PointerInfo, duration: number) => {
      if (!deviceId) return
      const distance = Math.hypot(info.lastDevice.x - info.startDevice.x, info.lastDevice.y - info.startDevice.y)

      let payload: TouchEventPayload
      if (distance <= LONG_PRESS_MOVE_TOLERANCE && duration >= LONG_PRESS_THRESHOLD_MS) {
        payload = {
          type: 'long_press',
          start: info.startDevice,
          durationMs: duration,
        }
      } else if (distance >= SWIPE_DISTANCE_THRESHOLD) {
        payload = {
          type: 'swipe',
          start: info.startDevice,
          end: info.lastDevice,
          durationMs: duration,
        }
      } else {
        payload = {
          type: 'tap',
          start: info.lastDevice,
        }
      }

      try {
        await sendTouchEvent(deviceId, payload)
        setLastGesture(
          `${gestureLabelMap[payload.type]} · ${
            payload.type === 'swipe' && payload.end
              ? `(${payload.start.x},${payload.start.y}) → (${payload.end.x},${payload.end.y})`
              : `(${payload.start.x},${payload.start.y})`
          }`,
        )
        message.success(`${gestureLabelMap[payload.type]}指令已发送`)
        void refreshOnceSilently()
      } catch (err) {
        console.error(err)
        message.error('发送触控指令失败')
      } finally {
      }
    },
    [deviceId, refreshOnceSilently],
  )

  const handlePointerUp = useCallback(
    async (event: React.PointerEvent<HTMLDivElement>) => {
      const info = pointerInfoRef.current
      if (!info || info.pointerId !== event.pointerId) {
        return
      }
      pointerInfoRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
      const duration = Date.now() - info.startTime
      await concludeGesture(info, duration)
    },
    [concludeGesture],
  )

  const handlePointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const info = pointerInfoRef.current
    if (info && info.pointerId === event.pointerId) {
      pointerInfoRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const ensureRemoteScript = useCallback(
    async (key: keyof typeof REMOTE_SCRIPTS) => {
      if (!deviceId) return null
      const def = REMOTE_SCRIPTS[key]
      const targetName = def.id

      const findScriptId = (scripts: ScriptSummary[] | null | undefined): string | null => {
        if (!scripts) return null
        const match = scripts.find((s) => {
          if (s.id === targetName || s.name === targetName) return true
          if (s.path && s.path.endsWith(targetName)) return true
          return false
        })
        return match?.id ?? null
      }

      let scripts = deviceScripts
      if (!scripts) {
        try {
          scripts = await fetchDeviceScripts(deviceId)
          setDeviceScripts(scripts)
        } catch (err) {
          console.error(err)
        }
      }

      let scriptId = findScriptId(scripts)
      if (!scriptId) {
        await pushInlineScriptToDevice(deviceId, {
          name: targetName,
          content: def.content,
          runImmediately: false,
        })
        try {
          const refreshed = await fetchDeviceScripts(deviceId)
          setDeviceScripts(refreshed)
          scriptId = findScriptId(refreshed)
        } catch (err) {
          console.error(err)
        }
      }

      return scriptId ?? null
    },
    [deviceId, deviceScripts],
  )

  useEffect(() => {
    void loadScreenshot()
  }, [loadScreenshot])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(REMOTE_SCREEN_SETTINGS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<{
          autoRefreshMs: number
          screenshotQuality: number
          screenshotResolution: ScreenshotResolutionValue
          scale: number
        }>
        if (typeof parsed.autoRefreshMs === 'number') {
          setAutoRefreshMs(parsed.autoRefreshMs)
        }
        if (typeof parsed.screenshotQuality === 'number') {
          setScreenshotQuality(parsed.screenshotQuality)
        }
        if (
          parsed.screenshotResolution === 'low' ||
          parsed.screenshotResolution === 'medium' ||
          parsed.screenshotResolution === 'high' ||
          parsed.screenshotResolution === 'original'
        ) {
          setScreenshotResolution(parsed.screenshotResolution)
        }
        if (typeof parsed.scale === 'number') {
          setScale(parsed.scale)
        }
      }
    } catch (err) {
      console.error('Failed to restore remote screen settings', err)
    } finally {
      settingsLoadedRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!settingsLoadedRef.current) return
    try {
      const data = {
        autoRefreshMs,
        screenshotQuality,
        screenshotResolution,
        scale,
      }
      window.localStorage.setItem(REMOTE_SCREEN_SETTINGS_KEY, JSON.stringify(data))
    } catch (err) {
      console.error('Failed to persist remote screen settings', err)
    }
  }, [autoRefreshMs, screenshotQuality, screenshotResolution, scale])

  useEffect(() => {
    if (!deviceId || autoRefreshMs <= 0) {
      return
    }
    const id = window.setInterval(() => {
      void refreshOnceSilently()
    }, autoRefreshMs)
    return () => {
      window.clearInterval(id)
    }
  }, [autoRefreshMs, deviceId, refreshOnceSilently])

  useEffect(() => {
    if (!deviceId) {
      setDeviceScripts(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const scripts = await fetchDeviceScripts(deviceId)
        if (!cancelled) {
          setDeviceScripts(scripts)
        }
      } catch (err) {
        console.error(err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [deviceId])

  useEffect(() => {
    if (!deviceId) return
    ;(async () => {
      try {
        await Promise.all([
          ensureRemoteScript('back'),
          ensureRemoteScript('home'),
          ensureRemoteScript('recents'),
          ensureRemoteScript('notifications'),
          ensureRemoteScript('screenOn'),
          ensureRemoteScript('screenOff'),
          ensureRemoteScript('volumeUp'),
          ensureRemoteScript('volumeDown'),
          ensureRemoteScript('mute'),
        ])
      } catch (err) {
        console.error(err)
      }
    })()
  }, [deviceId, ensureRemoteScript])

  if (!deviceId) {
    return (
      <Card className="page-card">
        <Empty description="缺少设备 ID" />
      </Card>
    )
  }

  return (
    <div className="page-container">
      <Card
        className="page-card"
        title={`远程控制：${deviceId}`}
        extra={
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/devices/${encodeURIComponent(deviceId)}`)}
            size="small"
          >
            返回设备详情
          </Button>
          <Link to="/devices">
            <Button size="small">返回设备列表</Button>
          </Link>
        </Space>
      }
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space wrap>
          <Button icon={<VideoCameraOutlined />} onClick={loadScreenshot} loading={screenshotLoading}>
            刷新截图
          </Button>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleRequestScreenshot}
            loading={requestingScreenshot}
          >
            请求设备截图
          </Button>
          <Select
            size="small"
            style={{ minWidth: 160 }}
            value={autoRefreshMs}
            onChange={(value) => setAutoRefreshMs(value as number)}
            options={AUTO_REFRESH_OPTIONS}
          />
          <Select
            size="small"
            style={{ minWidth: 160 }}
            value={screenshotQuality}
            onChange={(value) => setScreenshotQuality(value as number)}
            options={SCREENSHOT_QUALITY_OPTIONS}
          />
          <Select
            size="small"
            style={{ minWidth: 200 }}
            value={screenshotResolution}
            onChange={(value) => setScreenshotResolution(value as ScreenshotResolutionValue)}
            options={SCREENSHOT_RESOLUTION_OPTIONS}
          />
          <Tag color={remoteScreenshot ? 'blue' : 'default'}>
            {remoteScreenshot?.timestamp
              ? `更新时间：${new Date(remoteScreenshot.timestamp).toLocaleTimeString()}`
              : '尚未获取截图'}
          </Tag>
          {lastGesture && <Tag color="purple">最后操作：{lastGesture}</Tag>}
        </Space>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', width: '100%' }}>
          <div className="remote-screen-wrapper" style={{ flex: '1 1 400px', minWidth: '300px' }}>
            {remoteScreenshot ? (
              <div
                className="remote-screen-board"
                style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onPointerLeave={handlePointerCancel}
                role="button"
                tabIndex={0}
              >
                <img
                  className="remote-screen-image"
                  src={`data:${remoteScreenshot.contentType};base64,${remoteScreenshot.data}`}
                  alt="Remote screen"
                  draggable={false}
                />
              </div>
            ) : (
              <Empty description="暂无截图，可尝试请求设备截图" />
            )}
          </div>
          <div style={{ flex: '1 1 200px', minWidth: '200px', maxWidth: '100%' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 8,
              }}
            >
              <Select
                size="small"
                style={{ width: '100%', gridColumn: '1 / -1' }}
                value={scale}
                onChange={(value) => setScale(value as number)}
                options={SCALE_OPTIONS}
              />
              <Button
                block
                onClick={async () => {
                  if (!deviceId) return
                  try {
                    const scriptId = await ensureRemoteScript('back')
                    if (!scriptId) return
                    await runDeviceScript(deviceId, scriptId)
                  } catch (err) {
                    console.error(err)
                    message.error('发送返回指令失败')
                  }
                }}
              >
                返回
              </Button>
              <Button
                block
                onClick={async () => {
                  if (!deviceId) return
                  try {
                    const scriptId = await ensureRemoteScript('home')
                    if (!scriptId) return
                    await runDeviceScript(deviceId, scriptId)
                  } catch (err) {
                    console.error(err)
                    message.error('发送首页指令失败')
                  }
                }}
              >
                首页
              </Button>
              <Button
                block
                onClick={async () => {
                  if (!deviceId) return
                  try {
                    const scriptId = await ensureRemoteScript('recents')
                    if (!scriptId) return
                    await runDeviceScript(deviceId, scriptId)
                  } catch (err) {
                    console.error(err)
                    message.error('发送任务管理器指令失败')
                  }
                }}
              >
                任务管理器
              </Button>
              <Button
                block
                onClick={async () => {
                  if (!deviceId) return
                  try {
                    const scriptId = await ensureRemoteScript('notifications')
                    if (!scriptId) return
                    await runDeviceScript(deviceId, scriptId)
                  } catch (err) {
                    console.error(err)
                    message.error('发送通知栏指令失败')
                  }
                }}
              >
                通知栏
              </Button>
              <Button
                block
                onClick={async () => {
                  if (!deviceId) return
                  try {
                    const scriptId = await ensureRemoteScript('screenOn')
                    if (!scriptId) return
                    await runDeviceScript(deviceId, scriptId)
                  } catch (err) {
                    console.error(err)
                    message.error('发送亮屏指令失败')
                  }
                }}
              >
                亮屏
              </Button>
              <Button
                block
                onClick={async () => {
                  if (!deviceId) return
                  try {
                    const scriptId = await ensureRemoteScript('screenOff')
                    if (!scriptId) return
                    await runDeviceScript(deviceId, scriptId)
                  } catch (err) {
                    console.error(err)
                    message.error('发送息屏指令失败')
                  }
                }}
              >
                息屏
              </Button>
              <Button
                block
                onClick={async () => {
                  if (!deviceId) return
                  try {
                    const scriptId = await ensureRemoteScript('volumeUp')
                    if (!scriptId) return
                    await runDeviceScript(deviceId, scriptId)
                  } catch (err) {
                    console.error(err)
                    message.error('发送音量+指令失败')
                  }
                }}
              >
                音量+
              </Button>
              <Button
                block
                onClick={async () => {
                  if (!deviceId) return
                  try {
                    const scriptId = await ensureRemoteScript('volumeDown')
                    if (!scriptId) return
                    await runDeviceScript(deviceId, scriptId)
                  } catch (err) {
                    console.error(err)
                    message.error('发送音量-指令失败')
                  }
                }}
              >
                音量-
              </Button>
              <Button
                block
                onClick={async () => {
                  if (!deviceId) return
                  try {
                    const scriptId = await ensureRemoteScript('mute')
                    if (!scriptId) return
                    await runDeviceScript(deviceId, scriptId)
                  } catch (err) {
                    console.error(err)
                    message.error('发送静音指令失败')
                  }
                }}
              >
                静音
              </Button>
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ marginBottom: 8 }}>远程输入：</div>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="输入内容 (支持中文)"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onPressEnter={handleSendText}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSendText}
                  loading={sendingText}
                />
              </Space.Compact>
            </div>

            <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
              <div style={{ marginBottom: 8 }}>画面操作：</div>
              <Space wrap>
                <Button
                  icon={<ExpandAltOutlined />}
                  onClick={() => setZoomModalVisible(true)}
                  disabled={!remoteScreenshot}
                >
                  放大画面
                </Button>
                <Select
                  style={{ width: 160 }}
                  options={SCALE_OPTIONS}
                  value={scale}
                  onChange={setScale}
                />
              </Space>
            </div>
          </div>
        </div>
        <Alert
          type="info"
          message="提示"
          description="按下并拖拽可发送滑动，长按约 0.7 秒可发送长按，轻点即发送点击。"
          showIcon
        />
      </Space>
    </Card>
    <Modal
      open={zoomModalVisible}
      footer={null}
      onCancel={() => setZoomModalVisible(false)}
      width="95vw"
      style={{ top: 20 }}
      bodyStyle={{ padding: 0, height: '90vh', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000' }}
      closable={false}
    >
      <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div
          style={{ position: 'relative', touchAction: 'none', userSelect: 'none', outline: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerCancel}
          tabIndex={0}
        >
          {remoteScreenshot ? (
            <img
              src={`data:${remoteScreenshot.contentType};base64,${remoteScreenshot.data}`}
              alt="Device Screen Zoomed"
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                objectFit: 'contain',
                display: 'block',
                userSelect: 'none',
              }}
              draggable={false}
            />
          ) : (
            <Empty description="暂无截图" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ color: '#fff' }} />
          )}
        </div>
        <Button
          shape="circle"
          icon={<CloseOutlined />}
          onClick={() => setZoomModalVisible(false)}
          style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}
        />
        <FloatButton.Group
          trigger="click"
          type="primary"
          style={{ right: 24, bottom: 24 }}
          icon={<MenuOutlined />}
        >
          <FloatButton
            icon={<CloseOutlined />}
            tooltip="关闭"
            onClick={() => setZoomModalVisible(false)}
          />
          <FloatButton
            icon={<ArrowLeftOutlined />}
            tooltip="返回"
            onClick={async () => {
              if (!deviceId) return
              const scriptId = await ensureRemoteScript('back')
              if (scriptId) await runDeviceScript(deviceId, scriptId)
            }}
          />
          <FloatButton
            icon={<HomeOutlined />}
            tooltip="首页"
            onClick={async () => {
              if (!deviceId) return
              const scriptId = await ensureRemoteScript('home')
              if (scriptId) await runDeviceScript(deviceId, scriptId)
            }}
          />
          <FloatButton
            icon={<AppstoreOutlined />}
            tooltip="任务管理器"
            onClick={async () => {
              if (!deviceId) return
              const scriptId = await ensureRemoteScript('recents')
              if (scriptId) await runDeviceScript(deviceId, scriptId)
            }}
          />
          <FloatButton
            icon={<NotificationOutlined />}
            tooltip="通知栏"
            onClick={async () => {
              if (!deviceId) return
              const scriptId = await ensureRemoteScript('notifications')
              if (scriptId) await runDeviceScript(deviceId, scriptId)
            }}
          />
          <FloatButton
            icon={<BulbFilled />}
            tooltip="亮屏"
            onClick={async () => {
              if (!deviceId) return
              const scriptId = await ensureRemoteScript('screenOn')
              if (scriptId) await runDeviceScript(deviceId, scriptId)
            }}
          />
          <FloatButton
            icon={<BulbOutlined />}
            tooltip="息屏"
            onClick={async () => {
              if (!deviceId) return
              const scriptId = await ensureRemoteScript('screenOff')
              if (scriptId) await runDeviceScript(deviceId, scriptId)
            }}
          />
          <FloatButton
            description="Vol+"
            tooltip="音量+"
            onClick={async () => {
              if (!deviceId) return
              const scriptId = await ensureRemoteScript('volumeUp')
              if (scriptId) await runDeviceScript(deviceId, scriptId)
            }}
          />
          <FloatButton
            description="Vol-"
            tooltip="音量-"
            onClick={async () => {
              if (!deviceId) return
              const scriptId = await ensureRemoteScript('volumeDown')
              if (scriptId) await runDeviceScript(deviceId, scriptId)
            }}
          />
          <FloatButton
            icon={<AudioMutedOutlined />}
            tooltip="静音"
            onClick={async () => {
              if (!deviceId) return
              const scriptId = await ensureRemoteScript('mute')
              if (scriptId) await runDeviceScript(deviceId, scriptId)
            }}
          />
        </FloatButton.Group>
      </div>
    </Modal>
  </div>
  )
}
