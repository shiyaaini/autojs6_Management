import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Card, Tabs, Descriptions, Tag, Space, Button, Table, Empty, message, Spin, Switch, Modal, Select, Input, Radio, Checkbox, AutoComplete, List } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined, SyncOutlined, PlayCircleOutlined, 
  ThunderboltOutlined,
  FolderAddOutlined,
  ThunderboltFilled,
  SoundOutlined,
  BulbOutlined,
  BulbFilled,
  ApiOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  SunOutlined,
  MoonOutlined,
  AudioOutlined,
  AudioMutedOutlined,
} from '@ant-design/icons'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  fetchDevice,
  fetchDeviceStatusStats,
  fetchDeviceScripts,
  fetchDeviceScriptRuns,
  requestDeviceScriptList,
  runDeviceScript,
  pushScriptToDevice,
  pushInlineScriptToDevice,
  requestRunningScripts,
  requestScheduledScripts,
  fetchRunningScripts,
  fetchScheduledScripts,
  requestScriptLog,
  fetchScriptLog,
  fetchRunScriptLog,
  requestScriptContent,
  fetchScriptContent,
  updateDeviceScript,
  deleteDeviceScripts,
  createDeviceTimedTask,
  deleteDeviceScheduledTask,
  createDeviceBroadcastTask,
  fetchDeviceApps,
  requestDeviceApps,
  createDeviceFolder,
} from '../api/devices'
import { fetchRepoScripts, updateRepoScriptContent } from '../api/repo'
import type {
  Device,
  ScriptRunRecord,
  ScriptSummary,
  RunningScriptInfo,
  ScheduledScriptInfo,
  DeviceAppInfo,
  DeviceStatusStats,
} from '../types'

const statusColorMap: Record<Device['status'], string> = {
  online: 'green',
  offline: 'red',
}

const scriptRunStatusColorMap: Record<string, string> = {
  success: 'green',
  error: 'red',
  running: 'blue',
  pending: 'orange',
  default: 'default',
}

const weekdayOptions: { label: string; value: number }[] = [
  { label: '一', value: 1 },
  { label: '二', value: 2 },
  { label: '三', value: 3 },
  { label: '四', value: 4 },
  { label: '五', value: 5 },
  { label: '六', value: 6 },
  { label: '日', value: 7 },
]

const broadcastPresets: { label: string; value: string }[] = [
  { label: 'AutoJs6 启动时', value: 'org.autojs.autojs.action.startup' },
  { label: '开机时', value: 'android.intent.action.BOOT_COMPLETED' },
  { label: '亮屏时', value: 'android.intent.action.SCREEN_ON' },
  { label: '息屏时', value: 'android.intent.action.SCREEN_OFF' },
  { label: '屏幕解锁时', value: 'android.intent.action.USER_PRESENT' },
  { label: '电量变化时', value: 'android.intent.action.BATTERY_CHANGED' },
  { label: '电源连接时', value: 'android.intent.action.ACTION_POWER_CONNECTED' },
  { label: '电源断开时', value: 'android.intent.action.ACTION_POWER_DISCONNECTED' },
  { label: '网络连接变化时', value: 'android.net.conn.CONNECTIVITY_CHANGE' },
  { label: '新应用安装时', value: 'android.intent.action.PACKAGE_ADDED' },
  { label: '应用卸载时', value: 'android.intent.action.PACKAGE_REMOVED' },
  { label: '应用更新时', value: 'android.intent.action.PACKAGE_REPLACED' },
  { label: '耳机插拔时', value: 'android.intent.action.HEADSET_PLUG' },
  { label: '某些设置更改时', value: 'android.intent.action.CONFIGURATION_CHANGED' },
  { label: '每分钟一次', value: 'android.intent.action.TIME_TICK' },
]

const formatBytes = (bytes?: number) => {
  if (!bytes && bytes !== 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatTimestamp = (value?: number) => (value ? new Date(value).toLocaleString() : '-')

const formatDuration = (ms: number) => {
  if (!ms || ms <= 0) return '0分钟'

  const totalMinutes = Math.floor(ms / (60 * 1000))
  const minutesInDay = 24 * 60
  const days = Math.floor(totalMinutes / minutesInDay)
  const remainAfterDays = totalMinutes % minutesInDay
  const hours = Math.floor(remainAfterDays / 60)
  const minutes = remainAfterDays % 60

  const parts: string[] = []

  if (days > 0) {
    parts.push(`${days}天`)
    if (hours > 0) {
      parts.push(`${hours}小时`)
    }
    return parts.join('')
  }

  if (hours > 0) {
    parts.push(`${hours}小时`)
    if (minutes > 0) {
      parts.push(`${minutes}分钟`)
    }
    return parts.join('')
  }

  // 小于 1 小时，直接显示分钟
  return `${minutes}分钟`
}

export function DeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [device, setDevice] = useState<Device | null>(null)
  const [deviceLoading, setDeviceLoading] = useState(false)
  const [scripts, setScripts] = useState<ScriptSummary[]>([])
  const [scriptsLoading, setScriptsLoading] = useState(false)
  const [requestingScriptList, setRequestingScriptList] = useState(false)
  const [runningScriptId, setRunningScriptId] = useState<string | null>(null)
  const [currentScriptId, setCurrentScriptId] = useState<string | null>(null)
  const [scriptRuns, setScriptRuns] = useState<ScriptRunRecord[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [monitorRuns, setMonitorRuns] = useState<ScriptRunRecord[]>([])
  const [monitorLoading, setMonitorLoading] = useState(false)
  const [monitorAutoRefresh, setMonitorAutoRefresh] = useState(true)
  const [monitorLastUpdated, setMonitorLastUpdated] = useState<number | null>(null)
  const [runningScripts, setRunningScripts] = useState<RunningScriptInfo[]>([])
  const [runningLoading, setRunningLoading] = useState(false)
  const [scheduledScripts, setScheduledScripts] = useState<ScheduledScriptInfo[]>([])
  const [scheduledLoading, setScheduledLoading] = useState(false)
  const [logLines, setLogLines] = useState<string[]>([])
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [logLoading, setLogLoading] = useState(false)
  const [logScriptId, setLogScriptId] = useState<string | null>(null)
  const [logAutoRefresh, setLogAutoRefresh] = useState(true)
  const [repoScripts, setRepoScripts] = useState<{ label: string; value: string }[]>([])
  const [repoLoading, setRepoLoading] = useState(false)
  const [pushModalVisible, setPushModalVisible] = useState(false)
  const [pushScriptPath, setPushScriptPath] = useState<string | undefined>(undefined)
  const [pushLocalName, setPushLocalName] = useState<string | null>(null)
  const [pushLocalContent, setPushLocalContent] = useState<string | null>(null)
  const [pushRunImmediately, setPushRunImmediately] = useState(true)
  const [newFolderModalVisible, setNewFolderModalVisible] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [pushTargetType, setPushTargetType] = useState<'root' | 'default' | 'custom'>('default')
  const [pushCustomFolder, setPushCustomFolder] = useState('')
  const logContainerRef = useRef<HTMLPreElement | null>(null)
  const pushFileInputRef = useRef<HTMLInputElement | null>(null)
  const hasRequestedAppsRef = useRef(false)

  const [mainTabKey, setMainTabKey] = useState<'scripts' | 'monitor'>('scripts')

  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editMode, setEditMode] = useState<'edit' | 'create'>('edit')
  const [editScriptId, setEditScriptId] = useState<string | null>(null)
  const [editScriptPath, setEditScriptPath] = useState<string | null>(null) // repo path (for push)
  const [editScriptName, setEditScriptName] = useState<string | null>(null)
  const [editScriptContent, setEditScriptContent] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  const [currentFolder, setCurrentFolder] = useState<string>('__ALL__')
  const [folderSelectModalVisible, setFolderSelectModalVisible] = useState(false)

  const [statusNow, setStatusNow] = useState(() => Date.now())
  const [selectedScriptIds, setSelectedScriptIds] = useState<React.Key[]>([])
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deleteTargets, setDeleteTargets] = useState<ScriptSummary[]>([])
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false)
  const [scheduleScript, setScheduleScript] = useState<ScriptSummary | null>(null)
  const [scheduleMode, setScheduleMode] = useState<'once' | 'daily' | 'weekly' | 'broadcast'>('daily')
  const [scheduleTime, setScheduleTime] = useState('') // HH:mm
  const [scheduleDateTime, setScheduleDateTime] = useState('') // datetime-local
  const [scheduleWeeklyDays, setScheduleWeeklyDays] = useState<number[]>([])
  const [broadcastPresetAction, setBroadcastPresetAction] = useState<string | null>(null)
  const [broadcastCustomAction, setBroadcastCustomAction] = useState('')
  const [broadcastLocal, setBroadcastLocal] = useState(false)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [editingScheduled, setEditingScheduled] = useState<ScheduledScriptInfo | null>(null)
  const [scheduledDeleteModalVisible, setScheduledDeleteModalVisible] = useState(false)
  const [scheduledDeleteTarget, setScheduledDeleteTarget] = useState<ScheduledScriptInfo | null>(null)
  const [scheduledDeleteLoading, setScheduledDeleteLoading] = useState(false)

  const [appSearchKeyword, setAppSearchKeyword] = useState('')
  const [apps, setApps] = useState<DeviceAppInfo[]>([])
  const [appsLoading, setAppsLoading] = useState(false)
  const [requestingApps, setRequestingApps] = useState(false)
  const [appTypeFilter, setAppTypeFilter] = useState<'all' | 'system' | 'user'>('all')

  const [statusStats, setStatusStats] = useState<DeviceStatusStats | null>(null)
  const [statusStatsLoading, setStatusStatsLoading] = useState(false)

  const filteredApps = useMemo(() => {
    const keyword = appSearchKeyword.trim().toLowerCase()
    let base = apps

    if (appTypeFilter === 'system') {
      base = base.filter((app) => app.isSystem)
    } else if (appTypeFilter === 'user') {
      base = base.filter((app) => app.isSystem === false)
    }

    if (!keyword) return base

    return base.filter((app) => {
      const name = (app.name ?? '').toLowerCase()
      const pkg = app.packageName.toLowerCase()
      const ver = (app.versionName ?? '').toLowerCase()
      return name.includes(keyword) || pkg.includes(keyword) || ver.includes(keyword)
    })
  }, [appSearchKeyword, apps, appTypeFilter])

  const folderOptions = useMemo(() => {
    const folders = new Set<string>()

    // 1. 优先使用设备上报的文件夹列表（包含空文件夹）
    if (device?.folders) {
      device.folders.forEach((f) => folders.add(f))
    }

    // 2. 兜底逻辑：从脚本路径中提取文件夹（兼容旧版客户端或辅助验证）
    scripts.forEach((script) => {
      if (!script.path) return
      const path = script.path.replace(/\\/g, '/')
      const parts = path.split('/')
      if (parts.length > 1) {
        const folder = parts.slice(0, parts.length - 1).join('/')
        if (folder) folders.add(folder)
      }
    })
    return Array.from(folders)
      .sort()
      .map((f) => ({ label: f, value: f }))
  }, [scripts, device])

  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
  const logModalWidth = isAndroid ? '95vw' : '80vw'
  const isAppsRoute = location.pathname.endsWith('/apps')

  const [deviceAutoRefresh, setDeviceAutoRefresh] = useState(true)

  const loadDevice = useCallback(async () => {
    if (!deviceId) return
    // setDeviceLoading(true) // Don't show loading spinner for background refresh
    try {
      const data = await fetchDevice(deviceId)
      setDevice(data)
    } catch (err) {
      console.error(err)
      // message.error('获取设备信息失败') // Suppress error for background refresh to avoid spam
    } finally {
      // setDeviceLoading(false)
    }
  }, [deviceId])

  // Auto refresh device info every 5 seconds if online
  useEffect(() => {
    if (!deviceAutoRefresh || !deviceId) return
    void loadDevice() // Load immediately on mount/enable
    const timer = setInterval(() => {
      void loadDevice()
    }, 5000)
    return () => clearInterval(timer)
  }, [deviceAutoRefresh, deviceId, loadDevice])

  const loadApps = useCallback(async () => {
    if (!deviceId) return
    setAppsLoading(true)
    try {
      const items = await fetchDeviceApps(deviceId)
      setApps(items)
    } catch (err) {
      console.error(err)
      message.error('获取应用列表失败')
    } finally {
      setAppsLoading(false)
    }
  }, [deviceId])

  const handleDeleteScripts = useCallback(() => {
    console.log('[DeviceDetailPage] handleDeleteScripts clicked', {
      deviceId,
      selectedScriptIds,
      scriptsCount: scripts.length,
    })
    if (!deviceId) return
    if (selectedScriptIds.length === 0) {
      message.warning('请选择要删除的脚本')
      return
    }
    const toDelete = scripts.filter((s) => selectedScriptIds.includes(s.id))
    if (toDelete.length === 0) {
      message.warning('未找到要删除的脚本')
      return
    }

    setDeleteTargets(toDelete)
    setDeleteModalVisible(true)
  }, [deviceId, selectedScriptIds, scripts])

  const handleOpenSchedule = useCallback((record: ScriptSummary) => {
    setScheduleScript(record)
    setScheduleMode('daily')
    setScheduleTime('')
    setScheduleDateTime('')
    setScheduleWeeklyDays([])
    setBroadcastPresetAction(null)
    setBroadcastCustomAction('')
    setBroadcastLocal(false)
    setEditingScheduled(null)
    setScheduleModalVisible(true)
  }, [])

  const handleEditScheduled = useCallback(
    (item: ScheduledScriptInfo) => {
      // 仅针对定时任务（TimedTask）提供编辑入口，广播任务后续再单独设计
      if (item.type && item.type !== 'timed') {
        message.info('当前暂不支持直接编辑广播触发任务，请删除后重新创建')
        return
      }

      const scriptId = item.id
      const fromScripts = scripts.find((s) => s.id === scriptId)
      const script: ScriptSummary = {
        id: scriptId,
        name: fromScripts?.name || item.name || scriptId,
        path: fromScripts?.path ?? scriptId,
        size: fromScripts?.size,
        updatedAt: fromScripts?.updatedAt,
      }

      setScheduleScript(script)

      const cron = item.cron ?? ''
      // 尝试从 cron 描述中推断模式和时间
      if (cron.startsWith('每天')) {
        setScheduleMode('daily')
        const m = cron.match(/(\d{2}:\d{2})$/)
        setScheduleTime(m ? m[1] : '')
        setScheduleWeeklyDays([])
        setScheduleDateTime('')
      } else if (cron.startsWith('每周')) {
        setScheduleMode('weekly')
        const timeMatch = cron.match(/(\d{2}:\d{2})$/)
        setScheduleTime(timeMatch ? timeMatch[1] : '')
        const dayPartMatch = cron.match(/^每周(.+)\s+\d{2}:\d{2}$/)
        if (dayPartMatch) {
          const part = dayPartMatch[1] // 例如 "周一、周三、周五"
          const map: Record<string, number> = {
            周一: 1,
            周二: 2,
            周三: 3,
            周四: 4,
            周五: 5,
            周六: 6,
            周日: 7,
          }
          const days: number[] = []
          part
            .split(/[、，,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((label) => {
              const v = map[label]
              if (v) days.push(v)
            })
          setScheduleWeeklyDays(days)
        } else {
          setScheduleWeeklyDays([])
        }
        setScheduleDateTime('')
      } else if (cron.startsWith('一次')) {
        setScheduleMode('once')
        const m = cron.match(/一次\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/)
        if (m) {
          const local = `${m[1]}T${m[2]}` // 转成 datetime-local 需要的格式
          setScheduleDateTime(local)
        } else {
          setScheduleDateTime('')
        }
        setScheduleTime('')
        setScheduleWeeklyDays([])
      } else {
        // 无法解析时，退化为每日模式，由用户手动调整
        setScheduleMode('daily')
        setScheduleTime('')
        setScheduleWeeklyDays([])
        setScheduleDateTime('')
      }

      setBroadcastPresetAction(null)
      setBroadcastCustomAction('')
      setBroadcastLocal(false)
      setEditingScheduled(item)
      setScheduleModalVisible(true)
    },
    [scripts],
  )

  const appsTab = (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="搜索应用名称 / 包名"
            style={{ maxWidth: 260 }}
            value={appSearchKeyword}
            onChange={(e) => setAppSearchKeyword(e.target.value)}
          />
          <Radio.Group
            size="small"
            value={appTypeFilter}
            onChange={(e) => setAppTypeFilter(e.target.value)}
          >
            <Radio.Button value="all">全部</Radio.Button>
            <Radio.Button value="user">用户应用</Radio.Button>
            <Radio.Button value="system">系统应用</Radio.Button>
          </Radio.Group>
          <Button onClick={loadApps} loading={appsLoading}>
            刷新应用列表
          </Button>
          <Button
            loading={requestingApps}
            onClick={async () => {
              if (!deviceId) return
              setRequestingApps(true)
              try {
                await requestDeviceApps(deviceId)
                message.success('已请求设备上报应用列表')
                setTimeout(() => {
                  void loadApps()
                }, 1000)
              } catch (err) {
                console.error(err)
                message.error('请求应用列表失败')
              } finally {
                setRequestingApps(false)
              }
            }}
          >
            请求设备上报
          </Button>
        </Space>
        <span style={{ color: '#888' }}>应用总数：{filteredApps.length}</span>
      </Space>
      {filteredApps.length === 0 ? (
        <Empty description={appSearchKeyword ? '未找到匹配的应用' : '暂无应用数据'} />
      ) : (
        <Table
          rowKey={(record) => record.packageName}
          dataSource={filteredApps}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
          bordered
          loading={appsLoading}
          columns={[
            {
              title: '应用名称',
              dataIndex: 'name',
              key: 'name',
              width: 200,
            },
            {
              title: '包名',
              dataIndex: 'packageName',
              key: 'packageName',
              ellipsis: true,
            },
            {
              title: '版本名',
              dataIndex: 'versionName',
              key: 'versionName',
              width: 140,
            },
            {
              title: '版本号',
              dataIndex: 'versionCode',
              key: 'versionCode',
              width: 120,
            },
            {
              title: '目标 SDK',
              dataIndex: 'targetSdk',
              key: 'targetSdk',
              width: 120,
              render: (v: number) => (v ? `API ${v}` : '-'),
            },
            {
              title: '系统应用',
              dataIndex: 'isSystem',
              key: 'isSystem',
              width: 120,
              render: (v: boolean) => <Tag color={v ? 'geekblue' : 'default'}>{v ? '是' : '否'}</Tag>,
            },
          ]}
        />
      )}
    </Space>
  )

  const handleConfirmDeleteScripts = useCallback(async () => {
    if (!deviceId) return
    if (deleteTargets.length === 0) {
      setDeleteModalVisible(false)
      return
    }

    setDeleteLoading(true)
    try {
      await deleteDeviceScripts(deviceId, deleteTargets.map((s) => s.id))
      message.success('删除脚本命令已发送')
      setSelectedScriptIds((prev) => prev.filter((id) => !deleteTargets.some((s) => s.id === id)))
      try {
        const data = await fetchDeviceScripts(deviceId)
        setScripts(data)
      } catch (err) {
        console.error(err)
        message.error('刷新脚本列表失败')
      }
      setDeleteModalVisible(false)
      setDeleteTargets([])
    } catch (err) {
      console.error(err)
      message.error('删除脚本失败')
    } finally {
      setDeleteLoading(false)
    }
  }, [deviceId, deleteTargets])

  const handleDeleteScheduled = useCallback(
    async (item: ScheduledScriptInfo) => {
      if (!deviceId) return

      const internalId = (item.scheduleId ?? item.id)?.toString().trim()
      if (!internalId) {
        message.warning('该定时任务缺少内部 ID，无法删除')
        return
      }

      try {
        await deleteDeviceScheduledTask(deviceId, internalId)
        message.success('删除定时任务命令已发送')

        try {
          await requestScheduledScripts(deviceId)
          setTimeout(async () => {
            try {
              const items = await fetchScheduledScripts(deviceId)
              setScheduledScripts(items)
            } catch (err) {
              console.error(err)
              message.error('刷新定时任务列表失败')
            }
          }, 1000)
        } catch (err) {
          console.error(err)
          message.error('刷新定时任务列表失败')
        }
      } catch (err) {
        console.error(err)
        message.error('删除定时任务失败')
      }
    },
    [deviceId],
  )

  const handleCreateTimedTask = useCallback(async () => {
    if (!deviceId || !scheduleScript) {
      message.warning('缺少设备或脚本信息')
      return
    }

    try {
      setScheduleLoading(true)

      const editingId =
        editingScheduled && (editingScheduled.scheduleId ?? editingScheduled.id)?.toString().trim()

      if (editingId) {
        try {
          await deleteDeviceScheduledTask(deviceId, editingId)
        } catch (err) {
          console.error(err)
          message.warning('删除旧定时任务失败，将继续创建新任务')
        }
      }

      if (scheduleMode === 'broadcast') {
        const action = (broadcastCustomAction || broadcastPresetAction || '').trim()
        if (!action) {
          message.warning('请选择或输入广播 Action')
          return
        }

        const payload: { scriptId: string; action: string; local?: boolean } = {
          scriptId: scheduleScript.id,
          action,
        }
        if (broadcastLocal) {
          payload.local = true
        }

        await createDeviceBroadcastTask(deviceId, payload)
        message.success('广播触发任务创建指令已发送')
        setScheduleModalVisible(false)
        setScheduleScript(null)
        setEditingScheduled(null)

        try {
          await requestScheduledScripts(deviceId)
          setTimeout(async () => {
            try {
              const items = await fetchScheduledScripts(deviceId)
              setScheduledScripts(items)
            } catch (err) {
              console.error(err)
              message.error('刷新定时任务列表失败')
            }
          }, 1000)
        } catch (err) {
          console.error(err)
          message.error('刷新定时任务列表失败')
        }

        return
      }

      const payload: { scriptId: string; mode: 'once' | 'daily' | 'weekly'; timestamp?: number; timeOfDay?: string; daysOfWeek?: number[] } = {
        scriptId: scheduleScript.id,
        // 此处已排除 broadcast 分支，类型上做一次断言
        mode: scheduleMode as 'once' | 'daily' | 'weekly',
      }

      if (scheduleMode === 'daily') {
        if (!scheduleTime) {
          message.warning('请选择每日执行时间')
          return
        }
        payload.timeOfDay = scheduleTime
      } else if (scheduleMode === 'weekly') {
        if (!scheduleTime) {
          message.warning('请选择每周执行时间')
          return
        }
        if (!scheduleWeeklyDays.length) {
          message.warning('请至少选择一个执行星期')
          return
        }
        payload.timeOfDay = scheduleTime
        payload.daysOfWeek = scheduleWeeklyDays
      } else {
        if (!scheduleDateTime) {
          message.warning('请选择执行时间')
          return
        }
        const ts = Date.parse(scheduleDateTime)
        if (Number.isNaN(ts)) {
          message.warning('执行时间格式不正确')
          return
        }
        payload.timestamp = ts
      }

      await createDeviceTimedTask(deviceId, payload)
      message.success('定时任务创建指令已发送')
      setScheduleModalVisible(false)
      setScheduleScript(null)
      setEditingScheduled(null)

      try {
        await requestScheduledScripts(deviceId)
        setTimeout(async () => {
          try {
            const items = await fetchScheduledScripts(deviceId)
            setScheduledScripts(items)
          } catch (err) {
            console.error(err)
            message.error('刷新定时任务列表失败')
          }
        }, 1000)
      } catch (err) {
        console.error(err)
        message.error('刷新定时任务列表失败')
      }
    } catch (err) {
      console.error(err)
      message.error('创建定时任务失败')
    } finally {
      setScheduleLoading(false)
    }
  }, [deviceId, scheduleScript, scheduleMode, scheduleTime, scheduleDateTime, scheduleWeeklyDays, broadcastPresetAction, broadcastCustomAction, broadcastLocal, editingScheduled])

  const loadRunning = useCallback(async () => {
    if (!deviceId) return
    setRunningLoading(true)
    try {
      const items = await fetchRunningScripts(deviceId)
      setRunningScripts(items)
    } catch (err) {
      console.error(err)
      message.error('获取正在运行脚本失败')
    } finally {
      setRunningLoading(false)
    }
  }, [deviceId])

  const loadScheduled = useCallback(async () => {
    if (!deviceId) return
    setScheduledLoading(true)
    try {
      const items = await fetchScheduledScripts(deviceId)
      setScheduledScripts(items)
    } catch (err) {
      console.error(err)
      message.error('获取定时脚本失败')
    } finally {
      setScheduledLoading(false)
    }
  }, [deviceId])

  const loadStatusStats = useCallback(async () => {
    if (!deviceId) return
    const to = Date.now()
    const from = to - 24 * 60 * 60 * 1000
    setStatusStatsLoading(true)
    try {
      const data = await fetchDeviceStatusStats(deviceId, from, to)
      setStatusStats(data)
    } catch (err) {
      console.error(err)
      message.error('获取在线情况统计失败')
    } finally {
      setStatusStatsLoading(false)
    }
  }, [deviceId])

  const loadScripts = useCallback(async () => {
    if (!deviceId) return
    setScriptsLoading(true)
    try {
      const data = await fetchDeviceScripts(deviceId)
      setScripts(data)
    } catch (err) {
      console.error(err)
      message.error('获取脚本列表失败')
    } finally {
      setScriptsLoading(false)
    }
  }, [deviceId])

  const loadMonitorRuns = useCallback(async () => {
    if (!deviceId) return
    setMonitorLoading(true)
    try {
      const runs = await fetchDeviceScriptRuns(deviceId)
      setMonitorRuns(runs.slice().sort((a, b) => b.timestamp - a.timestamp))
      setMonitorLastUpdated(Date.now())
    } catch (err) {
      console.error(err)
      message.error('获取运行监控数据失败')
    } finally {
      setMonitorLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    loadDevice()
    loadScripts()
    loadMonitorRuns()
    loadRunning()
    loadScheduled()
    loadApps()
    loadStatusStats()
  }, [loadDevice, loadScripts, loadMonitorRuns, loadRunning, loadScheduled, loadApps, loadStatusStats])

  useEffect(() => {
    if (!deviceId) return
    // 等设备基础信息加载出来后再决定是否请求应用列表，避免在设备离线或未连接时发起无意义请求
    if (!device) return
    if (apps.length > 0) return
    if (hasRequestedAppsRef.current) return
    if (device.status !== 'online') return

    hasRequestedAppsRef.current = true

    const doRequest = async () => {
      setRequestingApps(true)
      try {
        await requestDeviceApps(deviceId)
        setTimeout(() => {
          void loadApps()
        }, 1000)
      } catch (err) {
        console.error(err)
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('503') && msg.includes('Device offline or socket not ready')) {
          message.error('设备当前离线或未建立控制连接（WebSocket 未就绪），无法自动获取应用列表')
        } else {
          message.error('自动请求应用列表失败')
        }
      } finally {
        setRequestingApps(false)
      }
    }

    void doRequest()
  }, [deviceId, apps.length, device, loadApps])

  useEffect(() => {
    if (!monitorAutoRefresh) {
      return
    }
    const interval = window.setInterval(() => {
      void loadMonitorRuns()
    }, 10000)
    return () => window.clearInterval(interval)
  }, [monitorAutoRefresh, loadMonitorRuns])

  useEffect(() => {
    const id = window.setInterval(() => {
      setStatusNow(Date.now())
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const scriptNameMap = useMemo(() => {
    const map = new Map<string, string>()
    scripts.forEach((script) => {
      map.set(script.id, script.name)
    })
    return map
  }, [scripts])

  const sortedScripts = useMemo(() => {
    if (!scripts || scripts.length === 0) return scripts
    const normalize = (v?: string | null) => (v ?? '').trim().toLowerCase()
    const isMgmtScript = (s: ScriptSummary) => {
      const name = normalize(s.name)
      const path = normalize(s.path)
      // 以 __mgmt 开头的脚本视为系统功能脚本
      return name.startsWith('__mgmt') || path.includes('/__mgmt_') || path.startsWith('__mgmt')
    }

    const arr = scripts.slice()
    arr.sort((a, b) => {
      const aMgmt = isMgmtScript(a)
      const bMgmt = isMgmtScript(b)
      if (aMgmt === bMgmt) {
        // 同类之间保留原有顺序（稳定排序近似实现）
        return 0
      }
      // 非 __mgmt 脚本优先显示，__mgmt 系统脚本排在后面
      return aMgmt ? 1 : -1
    })
    return arr
  }, [scripts])

  const filteredScripts = useMemo(() => {
    if (currentFolder === '__ALL__') return sortedScripts
    return sortedScripts.filter((s) => {
      const path = (s.path || '').replace(/\\/g, '/')
      if (currentFolder === '__ROOT__') {
        return !path.includes('/')
      }
      return path.startsWith(currentFolder + '/')
    })
  }, [sortedScripts, currentFolder])

  const handleStopAllScripts = useCallback(async () => {
    if (!deviceId) return
    try {
      const normalize = (value?: string | null) => (value ?? '').replace(/\\/g, '/').trim()
      const stopScript = scripts.find((s) => {
        const name = normalize(s.name)
        const path = normalize(s.path)
        const id = normalize(s.id)
        return (
          name === 'stop.js' ||
          path.endsWith('/stop.js') ||
          path === 'stop.js' ||
          id.endsWith('/stop.js')
        )
      })

      if (stopScript) {
        await runDeviceScript(deviceId, stopScript.id)
        Modal.success({
          title: '已发送停止脚本命令',
          content: `已在设备 ${deviceId} 上运行脚本：${stopScript.name || 'stop.js'}`,
        })
        return
      }

      const stopContent =
        'if (typeof engines !== "undefined" && engines.stopAll) {\n' +
        '  if (typeof engines.stopAllAndToast === "function") {\n' +
        '    engines.stopAllAndToast();\n' +
        '  } else {\n' +
        '    engines.stopAll();\n' +
        '  }\n' +
        '}\n' +
        'console.hide();\n'

      await pushInlineScriptToDevice(deviceId, {
        name: 'stop.js',
        content: stopContent,
        runImmediately: true,
      })

      Modal.success({
        title: '已推送并执行 stop.js',
        content: `已向设备 ${deviceId} 推送 stop.js 并执行停止所有脚本的操作`,
      })
    } catch (err) {
      console.error(err)
      message.error('停止脚本失败')
    }
  }, [deviceId, scripts])

  const handleQuickAction = useCallback(async (type: 'screenOn' | 'screenOff' | 'volumeUp' | 'volumeDown' | 'brightnessUp' | 'brightnessDown' | 'bluetoothToggle') => {
    if (!deviceId) return
    let content = ''
    let name = ''
    switch (type) {
      case 'screenOn':
        name = 'screenOn.js'
        content = 'device.wakeUp();'
        break
      case 'screenOff':
        name = 'screenOff.js'
        content = 'if (typeof $lock !== "undefined" && $lock.lock) { $lock.lock(); } else { try { runtime.accessibilityBridge.getService().performGlobalAction(8); } catch(e) { console.error(e); } }'
        break
      case 'volumeUp':
        name = 'volumeUp.js'
        content = 'device.setMusicVolume(device.getMusicVolume() + 1);'
        break
      case 'volumeDown':
        name = 'volumeDown.js'
        content = 'device.setMusicVolume(device.getMusicVolume() - 1);'
        break
      case 'brightnessUp':
        name = 'brightnessUp.js'
        content = 'try { importClass(android.provider.Settings); var mode = Settings.System.getInt(context.getContentResolver(), Settings.System.SCREEN_BRIGHTNESS_MODE); if (mode == 1) { Settings.System.putInt(context.getContentResolver(), Settings.System.SCREEN_BRIGHTNESS_MODE, 0); } var b = device.getBrightness(); device.setBrightness(Math.min(255, b + 20)); } catch(e) { console.error(e); }'
        break
      case 'brightnessDown':
        name = 'brightnessDown.js'
        content = 'try { importClass(android.provider.Settings); var mode = Settings.System.getInt(context.getContentResolver(), Settings.System.SCREEN_BRIGHTNESS_MODE); if (mode == 1) { Settings.System.putInt(context.getContentResolver(), Settings.System.SCREEN_BRIGHTNESS_MODE, 0); } var b = device.getBrightness(); device.setBrightness(Math.max(0, b - 20)); } catch(e) { console.error(e); }'
        break
      case 'bluetoothToggle':
        name = 'bluetoothToggle.js'
        content = 'importClass(android.bluetooth.BluetoothAdapter); var adapter = BluetoothAdapter.getDefaultAdapter(); if (adapter) { var enabled = adapter.isEnabled(); var success = false; try { if (enabled) { success = adapter.disable(); } else { success = adapter.enable(); } } catch(e) { console.error("Standard toggle failed: " + e); } if (!success) { try { var cmd = enabled ? "svc bluetooth disable" : "svc bluetooth enable"; var r = shell(cmd, true); if (r.code == 0) success = true; } catch(e) { console.error("Root toggle failed: " + e); } } console.log(enabled ? "关闭蓝牙" + (success?"成功":"失败") : "开启蓝牙" + (success?"成功":"失败")); }'
        break
    }

    try {
      await pushInlineScriptToDevice(deviceId, {
        name,
        content,
        runImmediately: true,
      })
      message.success('指令已发送')
    } catch (err) {
      console.error(err)
      message.error('指令发送失败')
    }
  }, [deviceId])

  const handleMuteConsole = useCallback(async () => {
    if (!deviceId) return
    try {
      const muteContent =
        'console.log("📱 手机静音控制程序");\n' +
        'console.log("====================");\n' +
        '\n' +
        'console.log("当前音量状态:");\n' +
        'console.log("媒体音量: " + device.getMusicVolume());\n' +
        'console.log("铃声音量: " + device.getMusicVolume());\n' +
        'console.log("通知音量: " + device.getMusicVolume());\n' +
        'console.log("");\n' +
        '\n' +
        'console.log("🔇 正在设置手机静音...");\n' +
        '\n' +
        'device.setMusicVolume(0);\n' +
        'console.log("✅ 媒体音量已设置为: 0");\n' +
        '\n' +
        'try {\n' +
        '    device.setVolume(0, 2);\n' +
        '    console.log("✅ 铃声音量已设置为: 0");\n' +
        '} catch (e) {\n' +
        '    console.log("⚠️  铃声音量设置失败: " + e.toString());\n' +
        '}\n' +
        '\n' +
        'try {\n' +
        '    device.setVolume(0, 5);\n' +
        '    console.log("✅ 通知音量已设置为: 0");\n' +
        '} catch (e) {\n' +
        '    console.log("⚠️  通知音量设置失败: " + e.toString());\n' +
        '}\n' +
        '\n' +
        'console.log("");\n' +
        'console.log("静音操作完成!");\n' +
        'console.log("当前音量状态:");\n' +
        'console.log("媒体音量: " + device.getMusicVolume());\n' +
        '\n' +
        'toast("手机已静音");\n' +
        '\n' +
        'setTimeout(function() {\n' +
        '    console.log("");\n' +
        '    console.log("程序将在3秒后自动退出...");\n' +
        '}, 1000);\n' +
        '\n' +
        'setTimeout(function() {\n' +
        '    console.log("程序已退出");\n' +
        '    console.hide();\n' +
        '}, 4000);\n'

      await pushInlineScriptToDevice(deviceId, {
        name: 'mute.js',
        content: muteContent,
        runImmediately: true,
      })

      Modal.success({
        title: '已执行静音脚本',
        content: `已向设备 ${deviceId} 推送并执行 mute.js 静音脚本`,
      })
    } catch (err) {
      console.error(err)
      message.error('静音控制台失败')
    }
  }, [deviceId])

  const handleCreateFolder = useCallback(async () => {
    if (!deviceId) return
    const name = newFolderName.trim()
    if (!name) {
      message.warning('请输入文件夹名称')
      return
    }
    try {
      await createDeviceFolder(deviceId, name)
      message.success('创建文件夹指令已发送')
      setNewFolderModalVisible(false)
      setNewFolderName('')
      setTimeout(() => {
        void loadScripts()
      }, 1000)
    } catch (err) {
      console.error(err)
      message.error('创建文件夹失败')
    }
  }, [deviceId, newFolderName, loadScripts])

  const handleRequestScriptList = useCallback(async () => {
    if (!deviceId) return
    setRequestingScriptList(true)
    try {
      await requestDeviceScriptList(deviceId)
      message.success('已发送脚本列表请求，等待设备上报')
    } catch (err) {
      console.error(err)
      message.error('请求脚本列表失败')
    } finally {
      setRequestingScriptList(false)
    }
  }, [deviceId])

  const handleRunScript = useCallback(
    async (scriptId: string) => {
      if (!deviceId) return
      setRunningScriptId(scriptId)
      try {
        await runDeviceScript(deviceId, scriptId)
        message.success('脚本运行指令已发送')
      } catch (err) {
        console.error(err)
        message.error('脚本运行指令发送失败')
      } finally {
        setRunningScriptId(null)
      }
    },
    [deviceId],
  )

  const handleOpenEdit = useCallback(
    async (record: ScriptSummary) => {
      if (!deviceId) return

      setEditMode('edit')
      setEditScriptId(record.id)
      // 如果是管理端推送的脚本，则尝试关联到仓库中的同名脚本，便于保存后复用推送机制
      const repoPath = record.path && record.path.startsWith('management_pushed/')
        ? record.path.replace(/^management_pushed\//, '')
        : null
      setEditScriptPath(repoPath)
      setEditScriptName(record.name)
      setEditModalVisible(true)
      setEditLoading(true)
      try {
        await requestScriptContent(deviceId, record.id)
        await new Promise((resolve) => setTimeout(resolve, 200))
        const content = await fetchScriptContent(deviceId, record.id)
        setEditScriptContent(content)
      } catch (err) {
        console.error(err)
        message.error('从设备加载脚本内容失败')
        setEditModalVisible(false)
        setEditScriptId(null)
        setEditScriptPath(null)
        setEditScriptName(null)
      } finally {
        setEditLoading(false)
      }
    },
    [deviceId],
  )

  const handleOpenCreateScript = useCallback(() => {
    setEditMode('create')
    setEditScriptId(null)
    setEditScriptPath(null)
    setEditScriptName('')
    setEditScriptContent('')
    setEditModalVisible(true)
  }, [])

  const handleViewRuns = useCallback(
    async (scriptId: string) => {
      if (!deviceId) return
      setCurrentScriptId(scriptId)
      setRunsLoading(true)
      try {
        const runs = await fetchDeviceScriptRuns(deviceId, scriptId)
        setScriptRuns(runs.slice().sort((a, b) => b.timestamp - a.timestamp))
      } catch (err) {
        console.error(err)
        message.error('获取脚本运行记录失败')
      } finally {
        setRunsLoading(false)
      }
    },
    [deviceId],
  )

  const fetchLatestLog = useCallback(
    async (scriptId: string, showError: boolean) => {
      if (!deviceId) return
      try {
        await requestScriptLog(deviceId, scriptId, 500)
        await new Promise((resolve) => setTimeout(resolve, 200))
        const lines = await fetchScriptLog(deviceId, scriptId, 500)
        setLogLines(lines)
      } catch (err) {
        console.error(err)
        if (showError) {
          message.error('获取脚本日志失败')
        }
      }
    },
    [deviceId],
  )

  const handleViewLog = useCallback(
    async (scriptId: string) => {
      if (!deviceId) return
      setLogAutoRefresh(true)
      setLogScriptId(scriptId)
      setLogModalVisible(true)
      setLogLoading(true)
      try {
        await fetchLatestLog(scriptId, true)
      } finally {
        setLogLoading(false)
      }
    },
    [deviceId, fetchLatestLog],
  )

  const handleViewGlobalLog = useCallback(async () => {
    if (!deviceId) return
    const GLOBAL_ID = '__ALL__'
    setLogScriptId(GLOBAL_ID)
    setLogModalVisible(true)
    setLogLoading(true)
    try {
      await fetchLatestLog(GLOBAL_ID, true)
    } catch (err) {
      console.error(err)
      message.error('获取总日志失败')
    } finally {
      setLogLoading(false)
    }
  }, [deviceId, fetchLatestLog])

  const scriptColumns: ColumnsType<ScriptSummary> = useMemo(
    () => [
      {
        title: '脚本名称',
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: '脚本 ID',
        dataIndex: 'id',
        key: 'id',
        width: 260,
      },
      {
        title: '路径',
        dataIndex: 'path',
        key: 'path',
        ellipsis: true,
        render: (value?: string) => value ?? '-',
      },
      {
        title: '状态',
        key: 'status',
        width: 120,
        render: (_value, record) => {
          const normalize = (value?: string | null) => (value ?? '').replace(/\\/g, '/').trim()
          const scriptId = normalize(record.id)
          const scriptPath = normalize(record.path)

          const matchScriptId = (rawId: string | undefined) => {
            const id = normalize(rawId)
            if (!id) return false
            if (scriptId && id === scriptId) return true
            if (scriptPath && id.endsWith(`/${scriptPath}`)) return true
            return false
          }
          // 使用运行监控里的数据，取该脚本最新的一条运行记录
          let latest: ScriptRunRecord | undefined
          for (const run of monitorRuns) {
            if (!matchScriptId(run.scriptId)) continue
            if (!latest || run.timestamp > latest.timestamp) {
              latest = run
            }
          }

          if (!latest) {
            return <Tag>空闲</Tag>
          }

          if ((latest.status === 'success' || latest.status === 'error') && statusNow - latest.timestamp > 5000) {
            return <Tag>空闲</Tag>
          }

          const color = scriptRunStatusColorMap[latest.status] ?? scriptRunStatusColorMap.default
          return <Tag color={color}>{latest.status}</Tag>
        },
      },
      {
        title: '大小',
        dataIndex: 'size',
        key: 'size',
        width: 120,
        render: (value?: number) => formatBytes(value),
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 180,
        render: (value?: number) => formatTimestamp(value),
      },
      {
        title: '操作',
        key: 'actions',
        width: 260,
        render: (_value, record) => (
          <Space>
            <Button
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => handleRunScript(record.id)}
              loading={runningScriptId === record.id}
            >
              运行
            </Button>
            <Button type="link" onClick={() => handleOpenEdit(record)}>
              编辑
            </Button>
            <Button
              type="link"
              icon={<HistoryOutlined />}
              onClick={() => handleViewRuns(record.id)}
              loading={runsLoading && currentScriptId === record.id}
            >
              查看记录
            </Button>
            <Button type="link" onClick={() => handleViewLog(record.id)}>
              查看日志
            </Button>
            <Button type="link" onClick={() => handleOpenSchedule(record)}>
              添加定时任务
            </Button>
          </Space>
        ),
      },
    ],
    [handleRunScript, runningScriptId, handleViewRuns, runsLoading, currentScriptId, handleViewLog, monitorRuns, handleOpenEdit, handleOpenSchedule, statusNow],
  )

  const runColumns: ColumnsType<ScriptRunRecord> = useMemo(
    () => [
      {
        title: '时间',
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 200,
        render: (value: number) => new Date(value).toLocaleString(),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (value: string) => (
          <Tag color={scriptRunStatusColorMap[value] ?? scriptRunStatusColorMap.default}>{value}</Tag>
        ),
      },
      {
        title: '详情',
        dataIndex: 'detail',
        key: 'detail',
        ellipsis: true,
        render: (value?: string) => value ?? '-',
      },
      {
        title: '操作',
        key: 'actions',
        width: 120,
        render: (_value, record) => {
          const isRunning = record.status === 'running'
          return (
            <Button
              type="link"
              size="small"
              onClick={async () => {
                if (!deviceId) return
                if (isRunning) {
                  // 正在运行：查看当前实时日志（与脚本列表一致）
                  await handleViewLog(record.scriptId)
                  return
                }
                setLogAutoRefresh(false)
                setLogScriptId(record.scriptId)
                setLogModalVisible(true)
                setLogLoading(true)
                try {
                  const lines = await fetchRunScriptLog(deviceId, record.scriptId, record.timestamp, 500)
                  setLogLines(lines)
                } catch (err) {
                  console.error(err)
                  message.error('获取运行历史日志失败')
                } finally {
                  setLogLoading(false)
                }
              }}
            >
              查看日志
            </Button>
          )
        },
      },
    ],
    [deviceId, handleViewLog],
  )

  const currentScript = scripts.find((s) => s.id === currentScriptId)

  const monitorColumns: ColumnsType<ScriptRunRecord> = useMemo(
    () => [
      {
        title: '时间',
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 200,
        render: (value: number) => new Date(value).toLocaleString(),
      },
      {
        title: '脚本',
        dataIndex: 'scriptId',
        key: 'scriptId',
        width: 220,
        render: (value: string) => scriptNameMap.get(value) ?? value,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (value: string) => (
          <Tag color={scriptRunStatusColorMap[value] ?? scriptRunStatusColorMap.default}>{value}</Tag>
        ),
      },
      {
        title: '详情',
        dataIndex: 'detail',
        key: 'detail',
        ellipsis: true,
        render: (value?: string) => value ?? '-',
      },
    ],
    [scriptNameMap],
  )

  useEffect(() => {
    if (!logModalVisible || !logScriptId || !logAutoRefresh) {
      return
    }
    const id = window.setInterval(() => {
      void fetchLatestLog(logScriptId, false)
    }, 1000)
    return () => window.clearInterval(id)
  }, [logModalVisible, logScriptId, logAutoRefresh, fetchLatestLog])

  useEffect(() => {
    if (!logModalVisible) return
    const el = logContainerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [logLines, logModalVisible])

  const monitorTab = (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space wrap>
        <Button icon={<ReloadOutlined />} onClick={loadMonitorRuns} loading={monitorLoading}>
          刷新运行记录
        </Button>
        <Switch
          checkedChildren="自动刷新"
          unCheckedChildren="手动刷新"
          checked={monitorAutoRefresh}
          onChange={setMonitorAutoRefresh}
        />
        {monitorLastUpdated && <span>上次更新：{new Date(monitorLastUpdated).toLocaleTimeString()}</span>}
      </Space>
      <Table
        rowKey={(record) => `${record.timestamp}-${record.scriptId}-${record.status}`}
        columns={monitorColumns}
        dataSource={monitorRuns}
        loading={monitorLoading}
        pagination={{ pageSize: 10 }}
        bordered
        locale={{ emptyText: '暂时没有运行记录' }}
      />
      <Card title="当前运行脚本" size="small">
        <Space style={{ marginBottom: 12 }}>
          <Button onClick={loadRunning} loading={runningLoading}>
            刷新正在运行
          </Button>
          <Button
            onClick={async () => {
              if (!deviceId) return
              try {
                await requestRunningScripts(deviceId)
                message.success('已请求设备上报正在运行脚本')
                setTimeout(() => {
                  void loadRunning()
                }, 1000)
              } catch (err) {
                console.error(err)
                message.error('请求正在运行脚本失败')
              }
            }}
          >
            请求设备上报
          </Button>
        </Space>
        <Table
          rowKey={(record) => record.id}
          columns={[
            { title: '脚本 ID', dataIndex: 'id', key: 'id', width: 220 },
            { title: '名称', dataIndex: 'name', key: 'name', render: (v?: string) => v ?? '-' },
            {
              title: '开始时间',
              dataIndex: 'startedAt',
              key: 'startedAt',
              render: (v?: number) => (v ? new Date(v).toLocaleString() : '-'),
            },
          ]}
          dataSource={runningScripts}
          loading={runningLoading}
          pagination={false}
          locale={{ emptyText: '暂无正在运行脚本' }}
        />
      </Card>
      <Card title="定时脚本" size="small">
        <Space style={{ marginBottom: 12 }}>
          <Button
            onClick={async () => {
              if (!deviceId) return
              try {
                await requestScheduledScripts(deviceId)
                message.success('已请求设备上报定时脚本')
                setTimeout(() => {
                  void loadScheduled()
                }, 1000)
              } catch (err) {
                console.error(err)
                message.error('请求定时脚本失败')
              }
            }}
            loading={scheduledLoading}
          >
            刷新定时脚本
          </Button>
        </Space>
        <Table
          rowKey={(record) => record.scheduleId ?? record.id}
          columns={[
            { title: '脚本 ID', dataIndex: 'id', key: 'id', width: 220 },
            { title: '名称', dataIndex: 'name', key: 'name', render: (v?: string) => v ?? '-' },
            { title: 'Cron', dataIndex: 'cron', key: 'cron', render: (v?: string) => v ?? '-' },
            {
              title: '下次执行时间',
              dataIndex: 'nextRunAt',
              key: 'nextRunAt',
              render: (v?: number) => (v ? new Date(v).toLocaleString() : '-'),
            },
            {
              title: '操作',
              key: 'actions',
              width: 180,
              render: (_value, record: ScheduledScriptInfo) => (
                <Space size={8}>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      handleEditScheduled(record)
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    type="link"
                    danger
                    size="small"
                    onClick={() => {
                      setScheduledDeleteTarget(record)
                      setScheduledDeleteModalVisible(true)
                    }}
                    disabled={!record.scheduleId && !record.id}
                  >
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
          dataSource={scheduledScripts}
          loading={scheduledLoading}
          pagination={false}
          locale={{ emptyText: '暂无定时脚本' }}
        />
      </Card>
    </Space>
  )

  if (!deviceId) {
    return (
      <Card className="page-card">
        <Empty description="缺少设备 ID" />
      </Card>
    )
  }

  const scriptsTab = (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space wrap>
        <Button icon={<ReloadOutlined />} onClick={loadScripts} loading={scriptsLoading}>
          刷新脚本列表
        </Button>
        <Button
          icon={<SyncOutlined />}
          onClick={handleRequestScriptList}
          loading={requestingScriptList}
          type="primary"
        >
          请求设备重新上报
        </Button>
        <Button type="primary" onClick={handleOpenCreateScript}>
          新增脚本
        </Button>
        <Button icon={<FolderAddOutlined />} onClick={() => setNewFolderModalVisible(true)}>
          新建文件夹
        </Button>
        <Button onClick={handleViewGlobalLog}>查看总日志</Button>
        <Button onClick={handleMuteConsole}>静音</Button>
        <Button danger onClick={handleStopAllScripts}>
          停止所有脚本
        </Button>
        <Button
          danger
          disabled={selectedScriptIds.length === 0}
          onClick={handleDeleteScripts}
        >
          删除选中脚本
        </Button>
        <Button
          onClick={async () => {
            setRepoLoading(true)
            try {
              const list = await fetchRepoScripts()
              setRepoScripts(list.map((s) => ({ label: `${s.path}`, value: s.path })))
              setPushModalVisible(true)
            } catch (err) {
              console.error(err)
              message.error('加载服务端脚本仓库失败')
            } finally {
              setRepoLoading(false)
            }
          }}
          loading={repoLoading}
        >
          从服务端推送脚本
        </Button>
        <Button icon={<FolderOpenOutlined />} onClick={() => setFolderSelectModalVisible(true)}>
          {currentFolder === '__ALL__'
            ? '全部脚本'
            : currentFolder === '__ROOT__'
            ? '根目录'
            : currentFolder}
        </Button>
        <Modal
          open={folderSelectModalVisible}
          title="选择文件夹"
          footer={null}
          onCancel={() => setFolderSelectModalVisible(false)}
        >
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <List
              size="small"
              dataSource={[
                { label: '全部脚本', value: '__ALL__' },
                { label: '根目录', value: '__ROOT__' },
                ...folderOptions,
              ]}
              renderItem={(item) => (
                <List.Item
                  onClick={() => {
                    setCurrentFolder(item.value)
                    setFolderSelectModalVisible(false)
                  }}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: currentFolder === item.value ? '#e6f7ff' : undefined,
                  }}
                >
                  <Space>
                    <FolderOpenOutlined />
                    <span style={{ wordBreak: 'break-all' }}>{item.label}</span>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        </Modal>
      </Space>
      <Table
        rowKey={(record) => record.id}
        columns={scriptColumns}
        dataSource={filteredScripts}
        loading={scriptsLoading}
        pagination={{ pageSize: 8 }}
        bordered
        rowSelection={{
          selectedRowKeys: selectedScriptIds,
          onChange: (keys) => setSelectedScriptIds(keys),
          preserveSelectedRowKeys: true,
        }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: '暂无脚本' }}
      />
      <Card
        size="small"
        title={`运行记录${currentScript ? ` - ${currentScript.name}` : ''}`}
        extra={
          currentScriptId && (
            <Button
              type="link"
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => handleViewRuns(currentScriptId)}
              loading={runsLoading}
            >
              刷新当前记录
            </Button>
          )
        }
      >
        {scriptRuns.length === 0 ? (
          <Empty description={currentScriptId ? '暂无运行记录' : '请选择脚本查看运行记录'} />
        ) : (
          <Table
            rowKey={(record) => `${record.timestamp}-${record.status}`}
            columns={runColumns}
            dataSource={scriptRuns}
            size="small"
            loading={runsLoading}
            pagination={{ pageSize: 5 }}
          />
        )}
      </Card>
    </Space>
  )

  const handleManualRefresh = useCallback(async () => {
    setDeviceLoading(true)
    await loadDevice()
    setDeviceLoading(false)
  }, [loadDevice])

  return (
    <div className="page-container">
      <Card
        className="page-card"
        title={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleManualRefresh} loading={deviceLoading} />
            <span>{device?.remark ? `${device.remark} (${device.deviceId})` : device?.deviceId}</span>
            <Tag color={device?.status === 'online' ? 'green' : 'red'}>
              {device?.status === 'online' ? '在线' : '离线'}
            </Tag>
            {device?.battery !== undefined && (
              <Tag icon={device.isCharging ? <ThunderboltFilled /> : <ThunderboltOutlined />} color={device.isCharging ? 'green' : 'blue'}>
                {device.battery}%
              </Tag>
            )}
            {device?.volume !== undefined && (
              <Tag icon={<SoundOutlined />} color="cyan">
                音量: {device.volume}
              </Tag>
            )}
            {device?.brightness !== undefined && (
              <Tag icon={<BulbOutlined />} color="gold">
                亮度: {device.brightness}
              </Tag>
            )}
            {device?.bluetoothEnabled !== undefined && (
              <Tag icon={<ApiOutlined />} color={device.bluetoothEnabled ? 'blue' : 'default'}>
                蓝牙: {device.bluetoothEnabled ? '开' : '关'}
              </Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Switch
              checkedChildren="自动刷新"
              unCheckedChildren="暂停刷新"
              checked={deviceAutoRefresh}
              onChange={setDeviceAutoRefresh}
            />
            <Link to={`/devices/${encodeURIComponent(deviceId)}/remote`}>
              <Button size="small" type="primary" disabled={!device || device.status !== 'online'}>
                远程控制
              </Button>
            </Link>
          </Space>
        }
      >
        <Spin spinning={deviceLoading && !device}>
          {device ? (
            <>
              <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
                <Descriptions.Item label="设备 ID">{device.deviceId}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusColorMap[device.status]}>{device.status === 'online' ? '在线' : '离线'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="设备型号">{device.model ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="系统版本">{device.androidVersion ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="App 版本">{device.appVersion ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="最近心跳">{formatTimestamp(device.lastHeartbeat)}</Descriptions.Item>
              </Descriptions>
              <Descriptions bordered size="small" column={4} style={{ marginBottom: 24 }}>
                <Descriptions.Item label="电池">{device.battery !== undefined ? `${device.battery}%` : '-'}</Descriptions.Item>
                <Descriptions.Item label="音量">{device.volume !== undefined ? device.volume : '-'}</Descriptions.Item>
                <Descriptions.Item label="亮度">{device.brightness !== undefined ? device.brightness : '-'}</Descriptions.Item>
                <Descriptions.Item label="蓝牙">
                  {device.bluetoothEnabled !== undefined ? (device.bluetoothEnabled ? '开' : '关') : '-'}
                </Descriptions.Item>
              </Descriptions>
              <Card size="small" title="在线情况（最近 24 小时）" style={{ marginBottom: 24 }}>
                <Spin spinning={statusStatsLoading}>
                  {statusStats ? (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space wrap>
                        <span>
                          统计区间：
                          {new Date(statusStats.from).toLocaleString()} ~ {new Date(statusStats.to).toLocaleString()}
                        </span>
                        {(() => {
                          const total = Math.max(statusStats.to - statusStats.from, 1)
                          const onlinePercent = (statusStats.totalOnlineMs / total) * 100
                          const offlinePercent = (statusStats.totalOfflineMs / total) * 100
                          return (
                            <>
                              <Tag color="green">在线 {onlinePercent.toFixed(1)}%</Tag>
                              <Tag color="red">离线 {offlinePercent.toFixed(1)}%</Tag>
                            </>
                          )
                        })()}
                      </Space>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        在线时长约 {formatDuration(statusStats.totalOnlineMs)}，离线时长约{' '}
                        {formatDuration(statusStats.totalOfflineMs)}
                      </div>
                      {statusStats.segments.length > 0 ? (
                        <div style={{ marginTop: 8 }}>
                          <div
                            style={{
                              height: 12,
                              borderRadius: 6,
                              overflow: 'hidden',
                              background: '#f0f0f0',
                              display: 'flex',
                            }}
                          >
                            {statusStats.segments.map((seg, idx) => {
                              const total = Math.max(statusStats.to - statusStats.from, 1)
                              const dur = seg.end - seg.start
                              const widthPercent = (dur / total) * 100
                              return (
                                <div
                                  key={`${seg.start}-${seg.end}-${seg.status}-${idx}`}
                                  style={{
                                    width: `${widthPercent}%`,
                                    background: seg.status === 'online' ? '#52c41a' : '#ff4d4f',
                                  }}
                                />
                              )
                            })}
                          </div>
                          <div
                            style={{
                              marginTop: 8,
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: 12,
                              color: '#888',
                            }}
                          >
                            <span>← {new Date(statusStats.from).toLocaleTimeString()}</span>
                            <span>{new Date(statusStats.to).toLocaleTimeString()} →</span>
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
                            <span style={{ marginRight: 16 }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 12,
                                  height: 8,
                                  background: '#52c41a',
                                  marginRight: 4,
                                }}
                              />
                              在线
                            </span>
                            <span>
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 12,
                                  height: 8,
                                  background: '#ff4d4f',
                                  marginRight: 4,
                                }}
                              />
                              离线
                            </span>
                          </div>
                          {statusStats.segments.some((seg) => seg.status === 'offline') && (
                            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                              <div style={{ marginBottom: 4 }}>最近离线区间（最多显示 5 段）：</div>
                              {statusStats.segments
                                .filter((seg) => seg.status === 'offline')
                                .slice(-5)
                                .map((seg, idx) => (
                                  <div key={`${seg.start}-${seg.end}-offline-${idx}`}>
                                    {new Date(seg.start).toLocaleTimeString()} ~ {new Date(seg.end).toLocaleTimeString()}
                                    {'（约 '}
                                    {formatDuration(seg.end - seg.start)}
                                    {'）'}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Empty description="暂无在线趋势数据" />
                      )}
                      <Button
                        size="small"
                        onClick={() => {
                          void loadStatusStats()
                        }}
                      >
                        刷新在线统计
                      </Button>
                    </Space>
                  ) : (
                    <Empty description="暂无在线统计数据" />
                  )}
                </Spin>
              </Card>
              <Card size="small" title="快捷操作" style={{ marginBottom: 24 }}>
                <Space wrap>
                  <Button icon={<BulbOutlined />} onClick={() => handleQuickAction('screenOff')}>
                    息屏
                  </Button>
                  <Button icon={<BulbFilled />} onClick={() => handleQuickAction('screenOn')}>
                    亮屏
                  </Button>
                  <Button icon={<AudioOutlined />} onClick={() => handleQuickAction('volumeUp')}>
                    音量+
                  </Button>
                  <Button icon={<AudioMutedOutlined />} onClick={() => handleQuickAction('volumeDown')}>
                    音量-
                  </Button>
                  <Button icon={<SunOutlined />} onClick={() => handleQuickAction('brightnessUp')}>
                    亮度+
                  </Button>
                  <Button icon={<MoonOutlined />} onClick={() => handleQuickAction('brightnessDown')}>
                    亮度-
                  </Button>
                  <Button icon={<ApiOutlined />} onClick={() => handleQuickAction('bluetoothToggle')}>
                    蓝牙开关
                  </Button>
                </Space>
              </Card>
              <Tabs
                activeKey={isAppsRoute ? 'apps' : mainTabKey}
                onChange={(key) => {
                  if (!deviceId) return
                  if (key === 'apps') {
                    if (!isAppsRoute) {
                      navigate(`/devices/${encodeURIComponent(deviceId)}/apps`)
                    }
                    return
                  }

                  if (key === 'scripts' || key === 'monitor') {
                    setMainTabKey(key as 'scripts' | 'monitor')
                    if (isAppsRoute) {
                      navigate(`/devices/${encodeURIComponent(deviceId)}`)
                    }
                  }
                }}
                items={[
                {
                  key: 'scripts',
                  label: '脚本管理',
                  children: scriptsTab,
                },
                {
                  key: 'apps',
                  label: '应用列表',
                  children: appsTab,
                },
                {
                  key: 'monitor',
                  label: '运行监控',
                  children: monitorTab,
                },
              ]}
            />
            <Modal
              open={logModalVisible}
              title={logScriptId && logScriptId !== '__ALL__' ? `脚本日志 - ${logScriptId}` : '总日志'}
              footer={null}
              width={logModalWidth}
              style={{ top: '5vh' }}
              styles={{ body: { maxHeight: '85vh', overflow: 'auto' } }}
              onCancel={() => setLogModalVisible(false)}
            >
              <Spin spinning={logLoading}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <Switch
                      checkedChildren="自动刷新"
                      unCheckedChildren="停止刷新"
                      checked={logAutoRefresh}
                      onChange={setLogAutoRefresh}
                      size="small"
                    />
                    <Button
                      size="small"
                      onClick={async () => {
                        if (!logScriptId) return
                        setLogLoading(true)
                        try {
                          await fetchLatestLog(logScriptId, true)
                        } finally {
                          setLogLoading(false)
                        }
                      }}
                    >
                      手动刷新
                    </Button>
                  </Space>
                  {logLines.length === 0 ? (
                    <Empty description="暂无日志" />
                  ) : (
                    <pre
                      ref={logContainerRef}
                      style={{
                        maxHeight: '70vh',
                        overflow: 'auto',
                        background: '#1e1e1e',
                        color: '#d4d4d4',
                        padding: 12,
                        margin: 0,
                      }}
                    >
                      {logLines.join('\n')}
                    </pre>
                  )}
                </Space>
              </Spin>
            </Modal>
            <Modal
              open={editModalVisible}
              title={
                editMode === 'create'
                  ? '新增脚本'
                  : editScriptName
                    ? `编辑脚本 - ${editScriptName}`
                    : '编辑脚本'
              }
              width={logModalWidth}
              style={{ top: '5vh' }}
              styles={{ body: { maxHeight: '85vh', overflow: 'auto' } }}
              okText={editMode === 'create' ? '创建并推送' : '保存并推送'}
              cancelText="取消"
              confirmLoading={editSaving}
              onCancel={() => {
                setEditModalVisible(false)
                setEditScriptId(null)
                setEditScriptPath(null)
                setEditScriptName(null)
                setEditScriptContent('')
                setEditMode('edit')
              }}
              onOk={async () => {
                if (!deviceId) {
                  message.warning('缺少设备信息')
                  return
                }

                const nameRaw = (editScriptName ?? '').trim()

                if (editMode === 'create') {
                  if (!nameRaw) {
                    message.warning('请输入脚本名称')
                    return
                  }
                } else if (!editScriptId) {
                  message.warning('缺少脚本信息')
                  return
                }

                setEditSaving(true)
                try {
                  if (editMode === 'create') {
                    const finalName = nameRaw.endsWith('.js') ? nameRaw : `${nameRaw}.js`
                    await pushInlineScriptToDevice(deviceId, {
                      name: finalName,
                      content: editScriptContent,
                      runImmediately: false,
                    })
                    message.success('脚本已创建并推送到设备')
                  } else {
                    await updateDeviceScript(deviceId, editScriptId as string, editScriptContent)
                    if (editScriptPath) {
                      await updateRepoScriptContent(editScriptPath, editScriptContent)
                      message.success('脚本已保存到设备并同步到仓库')
                    } else {
                      message.success('脚本已保存到设备')
                    }
                  }
                  setEditModalVisible(false)
                  setEditScriptId(null)
                  setEditScriptPath(null)
                  setEditScriptName(null)
                  setEditScriptContent('')
                  setEditMode('edit')
                  void loadScripts()
                } catch (err) {
                  console.error(err)
                  message.error('保存或推送脚本失败')
                } finally {
                  setEditSaving(false)
                }
              }}
            >
              <Spin spinning={editLoading}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Input
                    placeholder="脚本名称，例如 my_script.js"
                    value={editScriptName ?? ''}
                    onChange={(e) => setEditScriptName(e.target.value)}
                    disabled={editMode === 'edit'}
                  />
                  <Input.TextArea
                    value={editScriptContent}
                    onChange={(e) => setEditScriptContent(e.target.value)}
                    autoSize={{ minRows: 16 }}
                    spellCheck={false}
                  />
                </Space>
              </Spin>
            </Modal>
            <Modal
              open={deleteModalVisible}
              title="确认删除脚本"
              okText="删除"
              okType="danger"
              cancelText="取消"
              confirmLoading={deleteLoading}
              onCancel={() => {
                setDeleteModalVisible(false)
                setDeleteTargets([])
              }}
              onOk={async () => {
                await handleConfirmDeleteScripts()
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>{`确定要删除选中的 ${deleteTargets.length} 个脚本吗？该操作会直接删除设备上的脚本文件。`}</div>
                {deleteTargets.length > 0 && (
                  <div>
                    即将删除：
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                      {deleteTargets.slice(0, 5).map((s) => (
                        <li key={s.id}>{s.name || s.id}</li>
                      ))}
                      {deleteTargets.length > 5 && <li>{`... 等共 ${deleteTargets.length} 个脚本`}</li>}
                    </ul>
                  </div>
                )}
              </Space>
            </Modal>
            <Modal
              open={scheduledDeleteModalVisible}
              title="删除定时任务"
              okText="删除"
              okType="danger"
              cancelText="取消"
              confirmLoading={scheduledDeleteLoading}
              onCancel={() => {
                setScheduledDeleteModalVisible(false)
                setScheduledDeleteTarget(null)
              }}
              onOk={async () => {
                if (!scheduledDeleteTarget) {
                  setScheduledDeleteModalVisible(false)
                  return
                }
                try {
                  setScheduledDeleteLoading(true)
                  await handleDeleteScheduled(scheduledDeleteTarget)
                  setScheduledDeleteModalVisible(false)
                  setScheduledDeleteTarget(null)
                } finally {
                  setScheduledDeleteLoading(false)
                }
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  确定要删除该定时任务吗？
                  {scheduledDeleteTarget?.name && `（${scheduledDeleteTarget.name}）`}
                </div>
                {scheduledDeleteTarget?.cron && <div>计划：{scheduledDeleteTarget.cron}</div>}
                {scheduledDeleteTarget?.nextRunAt && (
                  <div>下次执行时间：{new Date(scheduledDeleteTarget.nextRunAt).toLocaleString()}</div>
                )}
              </Space>
            </Modal>
            <Modal
              open={scheduleModalVisible}
              title={
                scheduleScript
                  ? editingScheduled
                    ? `修改定时任务 - ${scheduleScript.name}`
                    : `为脚本创建定时任务 - ${scheduleScript.name}`
                  : editingScheduled
                    ? '修改定时任务'
                    : '创建定时任务'
              }
              okText={editingScheduled ? '保存修改' : '创建'}
              cancelText="取消"
              confirmLoading={scheduleLoading}
              onCancel={() => {
                setScheduleModalVisible(false)
                setScheduleScript(null)
                setEditingScheduled(null)
              }}
              onOk={async () => {
                await handleCreateTimedTask()
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Radio.Group
                  value={scheduleMode}
                  onChange={(e) => setScheduleMode(e.target.value)}
                >
                  <Radio.Button value="daily">每天</Radio.Button>
                  <Radio.Button value="weekly">每周</Radio.Button>
                  <Radio.Button value="broadcast">广播触发</Radio.Button>
                  <Radio.Button value="once">一次</Radio.Button>
                </Radio.Group>
                {scheduleMode === 'daily' && (
                  <div>
                    <div style={{ marginBottom: 8 }}>每天执行时间：</div>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
                {scheduleMode === 'weekly' && (
                  <div>
                    <div style={{ marginBottom: 8 }}>每周执行时间：</div>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      style={{ width: '100%', marginBottom: 8 }}
                    />
                    <div style={{ marginBottom: 8 }}>执行星期：</div>
                    <Checkbox.Group
                      options={weekdayOptions}
                      value={scheduleWeeklyDays}
                      onChange={(values) => setScheduleWeeklyDays(values as number[])}
                    />
                  </div>
                )}
                {scheduleMode === 'broadcast' && (
                  <div>
                    <div style={{ marginBottom: 8 }}>选择常用触发事件（可选）：</div>
                    <Select
                      style={{ width: '100%', marginBottom: 8 }}
                      placeholder="选择常用广播事件，如亮屏、耳机插拔等"
                      allowClear
                      options={broadcastPresets}
                      value={broadcastPresetAction ?? undefined}
                      onChange={(value) => {
                        setBroadcastPresetAction((value ?? null) as string | null)
                      }}
                    />
                    <div style={{ marginBottom: 8 }}>或自定义 Action：</div>
                    <Input
                      placeholder="例如 android.intent.action.SCREEN_ON"
                      value={broadcastCustomAction}
                      onChange={(e) => setBroadcastCustomAction(e.target.value)}
                    />
                    <Checkbox
                      checked={broadcastLocal}
                      onChange={(e) => setBroadcastLocal(e.target.checked)}
                      style={{ marginTop: 8 }}
                    >
                      仅在应用内部触发（LocalBroadcast）
                    </Checkbox>
                  </div>
                )}
                {scheduleMode === 'once' && (
                  <div>
                    <div style={{ marginBottom: 8 }}>执行时间：</div>
                    <input
                      type="datetime-local"
                      value={scheduleDateTime}
                      onChange={(e) => setScheduleDateTime(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </Space>
            </Modal>
            <Modal
              open={newFolderModalVisible}
              title="新建文件夹"
              onCancel={() => setNewFolderModalVisible(false)}
              onOk={handleCreateFolder}
            >
              <Input
                placeholder="请输入文件夹名称"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onPressEnter={handleCreateFolder}
                autoFocus
              />
            </Modal>
            <Modal
              open={pushModalVisible}
              title="从服务端脚本仓库推送到设备"
              onCancel={() => {
                setPushModalVisible(false)
                setPushScriptPath(undefined)
              }}
              onOk={async () => {
                if (!deviceId) {
                  message.warning('缺少设备信息')
                  return
                }
                if (!pushScriptPath && !pushLocalContent) {
                  message.warning('请选择要推送的脚本，或上传本地脚本')
                  return
                }
                
                let targetFolder: string | undefined
                if (pushTargetType === 'root') {
                  targetFolder = '.'
                } else if (pushTargetType === 'custom') {
                  targetFolder = pushCustomFolder.trim()
                }

                try {
                  if (pushScriptPath) {
                    await pushScriptToDevice(deviceId, {
                      path: pushScriptPath,
                      runImmediately: pushRunImmediately,
                      targetFolder,
                    })
                  } else if (pushLocalName && pushLocalContent) {
                    await pushInlineScriptToDevice(deviceId, {
                      name: pushLocalName,
                      content: pushLocalContent,
                      runImmediately: pushRunImmediately,
                      targetFolder,
                    })
                  }
                  Modal.success({
                    title: '脚本推送已发送',
                    content: pushScriptPath
                      ? `已向设备 ${deviceId} 推送脚本：${pushScriptPath}`
                      : `已向设备 ${deviceId} 推送本地脚本：${pushLocalName ?? ''}`,
                  })
                  setPushModalVisible(false)
                  setPushScriptPath(undefined)
                  setPushLocalName(null)
                  setPushLocalContent(null)
                  void loadScripts()
                } catch (err) {
                  console.error(err)
                  message.error('脚本推送失败')
                }
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <input
                  type="file"
                  accept=".js,.ts"
                  style={{ display: 'none' }}
                  ref={pushFileInputRef}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      const text = await file.text()
                      setPushScriptPath(undefined)
                      setPushLocalName(file.name)
                      setPushLocalContent(text)
                      message.success(`已选择本地脚本：${file.name}`)
                    } catch (err) {
                      console.error(err)
                      message.error('读取本地脚本失败')
                    }
                  }}
                />
                <Select
                  showSearch
                  placeholder="选择要推送的脚本（来源：seaver/all_scripts）"
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  options={repoScripts}
                  value={pushScriptPath}
                  onChange={(value) => {
                    setPushScriptPath(value)
                    setPushLocalName(null)
                    setPushLocalContent(null)
                  }}
                />
                <Button onClick={() => pushFileInputRef.current?.click()}>浏览本地脚本...</Button>
                {pushLocalName && <span>当前本地脚本：{pushLocalName}</span>}
                
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8, marginTop: 8 }}>
                  <div style={{ marginBottom: 8 }}>上传位置：</div>
                  <Radio.Group
                    onChange={(e) => setPushTargetType(e.target.value)}
                    value={pushTargetType}
                  >
                    <Space direction="vertical">
                      <Radio value="default">默认 (management_pushed)</Radio>
                      <Radio value="root">脚本根目录</Radio>
                      <Radio value="custom">指定文件夹</Radio>
                    </Space>
                  </Radio.Group>
                  {pushTargetType === 'custom' && (
                    <AutoComplete
                      options={folderOptions}
                      placeholder="输入或选择文件夹名称/路径"
                      value={pushCustomFolder}
                      onChange={setPushCustomFolder}
                      style={{ marginTop: 8, width: '100%' }}
                      filterOption={(inputValue, option) =>
                        !inputValue || (option?.value as string).toLowerCase().includes(inputValue.toLowerCase())
                      }
                    />
                  )}
                </div>

                <div>
                  <label>
                    <input
                      type="checkbox"
                      checked={pushRunImmediately}
                      onChange={(e) => setPushRunImmediately(e.target.checked)}
                      style={{ marginRight: 4 }}
                    />
                    推送后立即运行
                  </label>
                </div>
              </Space>
            </Modal>
          </>
        ) : (
          !deviceLoading && <Empty description="未找到设备信息" />
        )}
      </Spin>
    </Card>
    </div>
  )
}
