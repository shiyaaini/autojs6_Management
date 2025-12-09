import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Card, Space, Button, Empty, message, Typography, Tag, Select, Modal, FloatButton } from 'antd'
import {
  ArrowLeftOutlined,
  HomeOutlined,
  AppstoreOutlined,
  MenuOutlined,
  NotificationOutlined,
  BulbOutlined,
  BulbFilled,
  CloseOutlined,
  AudioMutedOutlined,
} from '@ant-design/icons'
import type { Device, ScreenshotPayload, TouchEventPayload, ScriptSummary } from '../types'
import {
  fetchDevices,
  fetchScreenshot,
  requestScreenshot,
  sendTouchEvent,
  fetchDeviceScripts,
  runDeviceScript,
  pushInlineScriptToDevice,
} from '../api/devices'

const { Text } = Typography

const AUTO_REFRESH_OPTIONS: { label: string; value: number }[] = [
  { label: '自动刷新：关闭', value: 0 },
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

const SCREEN_WALL_SETTINGS_KEY = 'autojs6_screen_wall_settings'

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

const SWIPE_DISTANCE_THRESHOLD = 50
const LONG_PRESS_THRESHOLD_MS = 700
const LONG_PRESS_MOVE_TOLERANCE = 18

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

interface DeviceScreenTileProps {
  device: Device
  autoRefreshMs: number
  screenshotQuality: number
  screenshotResolution: ScreenshotResolutionValue
}

function DeviceScreenTile(props: DeviceScreenTileProps) {
  const { device, autoRefreshMs, screenshotQuality, screenshotResolution } = props
  const [remoteScreenshot, setRemoteScreenshot] = useState<ScreenshotPayload | null>(null)
  const [deviceScripts, setDeviceScripts] = useState<ScriptSummary[] | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const pointerInfoRef = useRef<PointerInfo | null>(null)

  const loadScreenshot = useCallback(async () => {
    if (device.status !== 'online') return
    try {
      const shot = await fetchScreenshot(device.deviceId)
      setRemoteScreenshot(shot)
    } catch (err) {
      console.error(err)
      message.error(`获取设备 ${device.deviceId} 截图失败`)
    }
  }, [device.deviceId, device.status])

  const refreshOnceSilently = useCallback(async () => {
    if (device.status !== 'online') return
    try {
      const { maxWidth, maxHeight } = getResolutionLimit(screenshotResolution)
      await requestScreenshot(device.deviceId, {
        quality: screenshotQuality,
        ...(typeof maxWidth === 'number' ? { maxWidth } : {}),
        ...(typeof maxHeight === 'number' ? { maxHeight } : {}),
      })
      const shot = await fetchScreenshot(device.deviceId)
      if (shot) {
        setRemoteScreenshot(shot)
      }
    } catch (err) {
      console.error(err)
    }
  }, [device.deviceId, device.status, screenshotQuality, screenshotResolution])

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
      if (device.status !== 'online' || !remoteScreenshot) return
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
    [convertPointerToDevice, device.status, remoteScreenshot],
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
      if (device.status !== 'online') return
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
        await sendTouchEvent(device.deviceId, payload)
        void refreshOnceSilently()
      } catch (err) {
        console.error(err)
        message.error(`向设备 ${device.deviceId} 发送触控指令失败`)
      }
    },
    [device.deviceId, device.status, refreshOnceSilently],
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
          scripts = await fetchDeviceScripts(device.deviceId)
          setDeviceScripts(scripts)
        } catch (err) {
          console.error(err)
        }
      }

      let scriptId = findScriptId(scripts)
      if (!scriptId) {
        await pushInlineScriptToDevice(device.deviceId, {
          name: targetName,
          content: def.content,
          runImmediately: false,
        })
        try {
          const refreshed = await fetchDeviceScripts(device.deviceId)
          setDeviceScripts(refreshed)
          scriptId = findScriptId(refreshed)
        } catch (err) {
          console.error(err)
        }
      }

      return scriptId ?? null
    },
    [device.deviceId, deviceScripts],
  )

  useEffect(() => {
    if (device.status !== 'online') {
      setRemoteScreenshot(null)
      return
    }
    void loadScreenshot()
  }, [device.status, loadScreenshot])

  useEffect(() => {
    if (device.status !== 'online' || autoRefreshMs <= 0) return
    const id = window.setInterval(() => {
      void refreshOnceSilently()
    }, autoRefreshMs)
    return () => {
      window.clearInterval(id)
    }
  }, [autoRefreshMs, device.status, refreshOnceSilently])

  const title = device.remark ? `${device.remark} · ${device.deviceId}` : device.deviceId

  return (
    <>
      <Card
        size="small"
        title={
          <Space>
            <span>{title}</span>
            <Tag color={device.status === 'online' ? 'green' : 'red'}>
              {device.status === 'online' ? '在线' : '离线'}
            </Tag>
          </Space>
        }
        extra={
          <Button size="small" onClick={() => setModalVisible(true)} disabled={device.status !== 'online'}>
            放大
          </Button>
        }
        bodyStyle={{ padding: 8 }}
      >
        {device.status !== 'online' ? (
          <Empty description="设备离线" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : remoteScreenshot ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              className="screen-wall-tile-board"
              style={{
                width: '100%',
                overflow: 'hidden',
                borderRadius: 4,
                border: '1px solid #f0f0f0',
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onPointerLeave={handlePointerCancel}
              role="button"
              tabIndex={0}
            >
              <img
                src={`data:${remoteScreenshot.contentType};base64,${remoteScreenshot.data}`}
                alt={`Screen of ${device.deviceId}`}
                style={{ display: 'block', width: '100%' }}
                draggable={false}
              />
            </div>
            <Space size="small" style={{ marginTop: 4 }}>
              <Button
                size="small"
                shape="circle"
                icon={<ArrowLeftOutlined />}
                title="返回"
                disabled={device.status !== 'online'}
                onClick={async () => {
                  try {
                    const scriptId = await ensureRemoteScript('back')
                    if (!scriptId) return
                    await runDeviceScript(device.deviceId, scriptId)
                  } catch (err) {
                    console.error(err)
                    message.error(`向设备 ${device.deviceId} 发送返回指令失败`)
                  }
                }}
              />
              <Button
                size="small"
                shape="circle"
                icon={<HomeOutlined />}
                title="首页"
                disabled={device.status !== 'online'}
                onClick={async () => {
                  try {
                    const scriptId = await ensureRemoteScript('home')
                    if (!scriptId) return
                    await runDeviceScript(device.deviceId, scriptId)
                  } catch (err) {
                    console.error(err)
                    message.error(`向设备 ${device.deviceId} 发送首页指令失败`)
                  }
                }}
              />
              <Button
                size="small"
                shape="circle"
                icon={<AppstoreOutlined />}
                title="任务管理器"
                disabled={device.status !== 'online'}
                onClick={async () => {
                  try {
                    const scriptId = await ensureRemoteScript('recents')
                    if (!scriptId) return
                    await runDeviceScript(device.deviceId, scriptId)
                  } catch (err) {
                    console.error(err)
                    message.error(`向设备 ${device.deviceId} 发送任务管理器指令失败`)
                  }
                }}
              />
            </Space>
          </div>
        ) : (
          <Empty description="暂无截图，可尝试请求截图" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
      <Modal
        open={modalVisible}
        title={null}
        footer={null}
        closable={false}
        width="100%"
        style={{ maxWidth: '100vw', top: 0, margin: 0, padding: 0, height: '100vh' }}
        styles={{ body: { height: '100vh', padding: 0, margin: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' } }}
        onCancel={() => setModalVisible(false)}
      >
        <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {device.status !== 'online' ? (
            <Empty description="设备离线" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : remoteScreenshot ? (
            <div
              className="screen-wall-modal-board"
              style={{
                position: 'relative',
                display: 'inline-block',
                overflow: 'hidden',
                touchAction: 'none',
                userSelect: 'none',
                lineHeight: 0,
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onPointerLeave={handlePointerCancel}
              role="button"
              tabIndex={0}
            >
              <img
                src={`data:${remoteScreenshot.contentType};base64,${remoteScreenshot.data}`}
                alt={`Screen of ${device.deviceId}`}
                style={{
                  display: 'block',
                  maxWidth: '100vw',
                  maxHeight: '100vh',
                  height: 'auto',
                  width: 'auto',
                  objectFit: 'contain',
                  userSelect: 'none',
                }}
                draggable={false}
              />
            </div>
          ) : (
            <Empty description="暂无截图，可尝试请求截图" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
          
          <FloatButton.Group
            trigger="click"
            type="primary"
            style={{ right: 24, bottom: 24 }}
            icon={<MenuOutlined />}
          >
            <FloatButton
              icon={<CloseOutlined />}
              tooltip="关闭"
              onClick={() => setModalVisible(false)}
            />
            <FloatButton
              icon={<ArrowLeftOutlined />}
              tooltip="返回"
              onClick={async () => {
                const scriptId = await ensureRemoteScript('back')
                if (scriptId) await runDeviceScript(device.deviceId, scriptId)
              }}
            />
            <FloatButton
              icon={<HomeOutlined />}
              tooltip="首页"
              onClick={async () => {
                const scriptId = await ensureRemoteScript('home')
                if (scriptId) await runDeviceScript(device.deviceId, scriptId)
              }}
            />
            <FloatButton
              icon={<AppstoreOutlined />}
              tooltip="任务管理器"
              onClick={async () => {
                const scriptId = await ensureRemoteScript('recents')
                if (scriptId) await runDeviceScript(device.deviceId, scriptId)
              }}
            />
            <FloatButton
              icon={<NotificationOutlined />}
              tooltip="通知栏"
              onClick={async () => {
                const scriptId = await ensureRemoteScript('notifications')
                if (scriptId) await runDeviceScript(device.deviceId, scriptId)
              }}
            />
             <FloatButton
              icon={<BulbFilled />}
              tooltip="亮屏"
              onClick={async () => {
                const scriptId = await ensureRemoteScript('screenOn')
                if (scriptId) await runDeviceScript(device.deviceId, scriptId)
              }}
            />
             <FloatButton
              icon={<BulbOutlined />}
              tooltip="息屏"
              onClick={async () => {
                const scriptId = await ensureRemoteScript('screenOff')
                if (scriptId) await runDeviceScript(device.deviceId, scriptId)
              }}
            />
            <FloatButton
              description="Vol+"
              tooltip="音量+"
              onClick={async () => {
                const scriptId = await ensureRemoteScript('volumeUp')
                if (scriptId) await runDeviceScript(device.deviceId, scriptId)
              }}
            />
            <FloatButton
              description="Vol-"
              tooltip="音量-"
              onClick={async () => {
                const scriptId = await ensureRemoteScript('volumeDown')
                if (scriptId) await runDeviceScript(device.deviceId, scriptId)
              }}
            />
            <FloatButton
              icon={<AudioMutedOutlined />}
              tooltip="静音"
              onClick={async () => {
                const scriptId = await ensureRemoteScript('mute')
                if (scriptId) await runDeviceScript(device.deviceId, scriptId)
              }}
            />
          </FloatButton.Group>
        </div>
      </Modal>
    </>
  )
}

export function ScreenWallPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [autoRefreshMs, setAutoRefreshMs] = useState<number>(2000)
  const [screenshotQuality, setScreenshotQuality] = useState<number>(60)
  const [screenshotResolution, setScreenshotResolution] = useState<ScreenshotResolutionValue>('low')
  const settingsLoadedRef = useRef(false)

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true)
    try {
      const list = await fetchDevices()
      setDevices(list)
    } catch (err) {
      console.error(err)
      message.error('加载设备列表失败')
    } finally {
      setDevicesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDevices()
  }, [loadDevices])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SCREEN_WALL_SETTINGS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<{
          autoRefreshMs: number
          screenshotQuality: number
          screenshotResolution: ScreenshotResolutionValue
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
      }
    } catch (err) {
      console.error('Failed to restore screen wall settings', err)
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
      }
      window.localStorage.setItem(SCREEN_WALL_SETTINGS_KEY, JSON.stringify(data))
    } catch (err) {
      console.error('Failed to persist screen wall settings', err)
    }
  }, [autoRefreshMs, screenshotQuality, screenshotResolution])

  const onlineDevices = useMemo(() => devices.filter((d) => d.status === 'online'), [devices])

  return (
    <Card className="page-card" title="屏幕墙">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space wrap>
          <Button onClick={() => void loadDevices()} loading={devicesLoading}>
            刷新设备列表
          </Button>
          <Tag color="blue">
            设备总数：{devices.length}，在线：{onlineDevices.length}
          </Tag>
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
          <Text type="secondary">提示：屏幕墙会按统一设置对所有在线设备周期刷新截图，请注意服务器与手机负载。</Text>
        </Space>
        {devices.length === 0 ? (
          <Empty description="暂无设备" />
        ) : onlineDevices.length === 0 ? (
          <Empty description="当前没有在线设备" />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
            }}
          >
            {onlineDevices.map((d) => (
              <DeviceScreenTile
                key={d.deviceId}
                device={d}
                autoRefreshMs={autoRefreshMs}
                screenshotQuality={screenshotQuality}
                screenshotResolution={screenshotResolution}
              />
            ))}
          </div>
        )}
      </Space>
    </Card>
  )
}
