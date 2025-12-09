import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, Space, Button, Table, Empty, message, Typography, Tag, Select, Modal, Input } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined, UploadOutlined } from '@ant-design/icons'
import type { ApkItem } from '../api/apk'
import { fetchApkList, uploadApk } from '../api/apk'
import { fetchDevices, installApkOnDevice } from '../api/devices'
import type { Device } from '../types'

const { Text } = Typography
const { Search } = Input

const formatBytes = (bytes?: number) => {
  if (!bytes && bytes !== 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatTimestamp = (value?: number) => (value ? new Date(value).toLocaleString() : '-')

export function SoftwareDistributionPage() {
  const [apks, setApks] = useState<ApkItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [targetDeviceIds, setTargetDeviceIds] = useState<string[]>([])
  const [deviceModalVisible, setDeviceModalVisible] = useState(false)
  const [deviceKeyword, setDeviceKeyword] = useState('')
  const [installMode, setInstallMode] = useState<'auto' | 'normal' | 'root'>('auto')

  const loadApks = useCallback(async () => {
    setLoading(true)
    try {
      const items = await fetchApkList()
      setApks(items)
    } catch (err) {
      console.error(err)
      message.error('获取 APK 列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true)
    try {
      const items = await fetchDevices()
      setDevices(items)
    } catch (err) {
      console.error(err)
      message.error('获取设备列表失败')
    } finally {
      setDevicesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadApks()
    void loadDevices()
  }, [loadApks, loadDevices])

  const handleSelectFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.apk')) {
      message.warning('请选择 APK 文件 (*.apk)')
      e.target.value = ''
      return
    }
    setUploading(true)
    try {
      await uploadApk(file)
      message.success('APK 上传成功')
      await loadApks()
    } catch (err) {
      console.error(err)
      message.error('APK 上传失败')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleInstall = useCallback(
    async (apk: ApkItem) => {
      if (!targetDeviceIds.length) {
        message.warning('请先选择要推送的目标设备')
        return
      }
      try {
        for (const deviceId of targetDeviceIds) {
          // 逐台设备下发安装指令
          // 如果数量很多，可根据需要改为 Promise.all 并发
          // 这里保持简单顺序发送，便于在服务器侧查看日志
          // eslint-disable-next-line no-await-in-loop
          await installApkOnDevice(deviceId, apk.name, installMode)
        }
        message.success(`已向 ${targetDeviceIds.length} 台设备发送安装指令`)
      } catch (err) {
        console.error(err)
        message.error('发送安装指令过程中出现错误，请检查部分设备状态')
      }
    },
    [installMode, targetDeviceIds],
  )

  const filteredDevices = useMemo(() => {
    const kw = deviceKeyword.trim().toLowerCase()
    if (!kw) return devices
    return devices.filter((d) => {
      const fields: (string | undefined)[] = [
        d.deviceId,
        d.model,
        d.manufacturer,
        d.appVersion,
        d.androidVersion,
        d.remark,
      ]
      return fields.some((v) => v && v.toLowerCase().includes(kw))
    })
  }, [devices, deviceKeyword])

  const deviceRowSelection = {
    selectedRowKeys: targetDeviceIds,
    onChange: (keys: React.Key[]) => setTargetDeviceIds(keys as string[]),
    preserveSelectedRowKeys: true,
  }

  const columns: ColumnsType<ApkItem> = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      width: 260,
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 140,
      render: (v?: number) => formatBytes(v),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 200,
      render: (v?: number) => formatTimestamp(v),
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
      render: (v: string) => <Text type="secondary">{v}</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_value, record) => (
        <Button type="link" size="small" onClick={() => handleInstall(record)} disabled={!targetDeviceIds.length}>
          推送安装
        </Button>
      ),
    },
  ]

  return (
    <Card className="page-card" title="软件分发">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadApks} loading={loading}>
            刷新列表
          </Button>
          <Button type="primary" icon={<UploadOutlined />} onClick={handleSelectFile} loading={uploading}>
            上传 APK
          </Button>
          <input
            type="file"
            accept=".apk"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Tag color="blue">服务器目录：all_apk</Tag>
          <Text type="secondary">上传的 APK 将保存在服务器的 all_apk 目录中，可推送安装到在线设备。</Text>
        </Space>
        <Space wrap>
          <Button onClick={() => setDeviceModalVisible(true)} disabled={devicesLoading || !devices.length}>
            {targetDeviceIds.length > 0
              ? `已选择 ${targetDeviceIds.length} 台设备`
              : '选择目标设备（可多选）'}
          </Button>
          <Select
            style={{ width: 200 }}
            value={installMode}
            onChange={(v) => setInstallMode(v as typeof installMode)}
            options={[
              { label: '安装模式：自动（优先 Root，否则系统安装界面）', value: 'auto' },
              { label: '安装模式：普通（系统安装界面）', value: 'normal' },
              { label: '安装模式：Root（尝试静默 pm install）', value: 'root' },
            ]}
          />
          <Text type="secondary">普通模式会在手机上弹出系统安装界面；Root 模式依赖设备已授予 Root 权限。</Text>
        </Space>
        {apks.length === 0 ? (
          <Empty description="暂无 APK 文件，可点击上方按钮上传" />
        ) : (
          <Table
            rowKey={(record) => record.path}
            dataSource={apks}
            columns={columns}
            loading={loading}
            bordered
            pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
          />
        )}
      </Space>
      <Modal
        open={deviceModalVisible}
        title="选择目标设备"
        width={800}
        onCancel={() => setDeviceModalVisible(false)}
        onOk={() => setDeviceModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Search
            placeholder="关键字搜索设备（ID / 型号 / 厂商 / 备注）"
            allowClear
            enterButton
            value={deviceKeyword}
            onChange={(e) => setDeviceKeyword(e.target.value)}
            onSearch={(value) => setDeviceKeyword(value)}
          />
          <Table
            rowKey={(record) => record.deviceId}
            columns={[
              { title: '设备 ID', dataIndex: 'deviceId', key: 'deviceId', width: 220 },
              { title: '设备型号', dataIndex: 'model', key: 'model', render: (v?: string) => v ?? '-' },
              { title: '备注', dataIndex: 'remark', key: 'remark', render: (v?: string) => v ?? '-' },
              {
                title: '系统版本',
                dataIndex: 'androidVersion',
                key: 'androidVersion',
                render: (v?: string) => v ?? '-',
              },
            ]}
            dataSource={filteredDevices}
            loading={devicesLoading}
            pagination={{ pageSize: 10 }}
            rowSelection={deviceRowSelection}
            bordered
            size="small"
          />
        </Space>
      </Modal>
    </Card>
  )
}
