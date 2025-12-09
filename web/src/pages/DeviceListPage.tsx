import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Empty, Space, Table, Tag, message, Input, Popconfirm } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined, SaveOutlined, DeleteOutlined, ThunderboltFilled, ThunderboltOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { fetchDevices, updateDeviceRemark, deleteDevice } from '../api/devices'
import type { Device } from '../types'

const statusColorMap: Record<Device['status'], string> = {
  online: 'green',
  offline: 'red',
}

export function DeviceListPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const navigate = useNavigate()

  const loadDevices = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchDevices()
      setDevices(result)
    } catch (err) {
      console.error(err)
      message.error('获取设备列表失败，请检查后端服务是否启动')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDevices()
    const timer = setInterval(loadDevices, 20000)
    return () => clearInterval(timer)
  }, [loadDevices])

  const handleRemarkLocalChange = useCallback((deviceId: string, remark: string) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.deviceId === deviceId
          ? {
              ...d,
              remark,
            }
          : d,
      ),
    )
  }, [])

  const handleRemarkSave = useCallback(async (deviceId: string, remark: string) => {
    const value = remark.trim()
    try {
      const updated = await updateDeviceRemark(deviceId, value)
      setDevices((prev) => prev.map((d) => (d.deviceId === deviceId ? { ...d, remark: updated } : d)))
      message.success('备注已保存')
    } catch (err) {
      console.error(err)
      message.error('保存备注失败')
    }
  }, [])

  const handleDeleteDevice = useCallback(async (deviceId: string) => {
    try {
      await deleteDevice(deviceId)
      message.success('设备已删除')
      setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId))
    } catch (err) {
      console.error(err)
      message.error('删除设备失败')
    }
  }, [])

  const columns: ColumnsType<Device> = useMemo(
    () => [
      {
        title: '设备 ID',
        dataIndex: 'deviceId',
        key: 'deviceId',
        width: 220,
      },
      {
        title: '设备型号',
        dataIndex: 'model',
        key: 'model',
        render: (value?: string) => value ?? '-',
      },
      {
        title: '系统版本',
        dataIndex: 'androidVersion',
        key: 'androidVersion',
        render: (value?: string) => value ?? '-',
      },
      {
        title: 'App 版本',
        dataIndex: 'appVersion',
        key: 'appVersion',
        render: (value?: string) => value ?? '-',
      },
      {
        title: '脚本数量',
        dataIndex: ['scripts'],
        key: 'scriptCount',
        render: (_value, record) => record.scripts?.length ?? 0,
      },
      {
        title: '备注',
        dataIndex: 'remark',
        key: 'remark',
        width: 260,
        render: (value: string | undefined, record) => (
          <Space>
            <Input
              size="small"
              placeholder="添加备注"
              value={value ?? ''}
              onChange={(e) => handleRemarkLocalChange(record.deviceId, e.target.value)}
              onPressEnter={(e) => {
                e.stopPropagation()
                const target = e.target as HTMLInputElement
                void handleRemarkSave(record.deviceId, target.value)
              }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: 160 }}
            />
            <Button
              size="small"
              icon={<SaveOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                void handleRemarkSave(record.deviceId, record.remark ?? '')
              }}
            />
          </Space>
        ),
      },
      {
        title: '最后心跳',
        dataIndex: 'lastHeartbeat',
        key: 'lastHeartbeat',
        render: (value?: number) => (value ? new Date(value).toLocaleString() : '-'),
      },
      {
        title: '电量',
        dataIndex: 'battery',
        key: 'battery',
        render: (value: number | undefined, record) => {
          if (value === undefined) return '-'
          return (
            <Tag
              icon={record.isCharging ? <ThunderboltFilled /> : <ThunderboltOutlined />}
              color={record.isCharging ? 'green' : value <= 20 ? 'red' : 'blue'}
            >
              {value}%
            </Tag>
          )
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        render: (value: Device['status']) => <Tag color={statusColorMap[value]}>{value === 'online' ? '在线' : '离线'}</Tag>,
      },
      {
        title: '操作',
        key: 'actions',
        width: 160,
        render: (_value, record) => (
          <Space>
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/devices/${record.deviceId}`)
              }}
            >
              详情
            </Button>
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/devices/${record.deviceId}/remote`)
              }}
              disabled={record.status !== 'online'}
            >
              远程控制
            </Button>
            <Popconfirm
              title="确定删除设备？"
              description="删除后该设备将从列表中移除，直到下次重新连接"
              onConfirm={(e) => {
                e?.stopPropagation()
                void handleDeleteDevice(record.deviceId)
              }}
              onCancel={(e) => e?.stopPropagation()}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleRemarkLocalChange, handleRemarkSave, handleDeleteDevice],
  )

  const filteredDevices = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
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
  }, [devices, keyword])

  return (
    <div className="page-card">
      <Space direction="vertical" style={{ marginBottom: 16, width: '100%' }} size="middle">
        <Space wrap>
          <Button type="primary" icon={<ReloadOutlined />} onClick={loadDevices} loading={loading}>
            刷新
          </Button>
          <Input
            placeholder="关键字搜索（设备 ID / 型号 / 备注）"
            allowClear
            style={{ width: 260 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </Space>
      </Space>
      {devices.length === 0 && !loading ? (
        <Empty description="暂无设备在线" />
      ) : (
        <Table
          rowKey={(record) => record.deviceId}
          columns={columns}
          dataSource={filteredDevices}
          loading={loading}
          pagination={false}
          bordered
          onRow={(record) => ({
            onClick: () => navigate(`/devices/${record.deviceId}`),
            style: { cursor: 'pointer' },
          })}
        />
      )}
    </div>
  )
}
