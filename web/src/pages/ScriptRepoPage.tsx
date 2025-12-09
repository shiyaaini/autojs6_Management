import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Empty, Input, Modal, Space, Table, Checkbox, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined, PlusOutlined, UploadOutlined, SendOutlined } from '@ant-design/icons'
import { fetchRepoScripts, fetchRepoScriptContent, updateRepoScriptContent, deleteRepoScript, type RepoScriptItem } from '../api/repo'
import { fetchDevices, pushScriptToDevice } from '../api/devices'
import type { Device } from '../types'

const { TextArea } = Input

const formatBytes = (bytes?: number) => {
  if (!bytes && bytes !== 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatTimestamp = (value?: number) => (value ? new Date(value).toLocaleString() : '-')

export function ScriptRepoPage() {
  const [scripts, setScripts] = useState<RepoScriptItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editVisible, setEditVisible] = useState(false)
  const [editPath, setEditPath] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [targetDeviceIds, setTargetDeviceIds] = useState<string[]>([])
  const [runImmediately, setRunImmediately] = useState(true)
  const [pushing, setPushing] = useState(false)
  const [deviceModalVisible, setDeviceModalVisible] = useState(false)
  const [deviceKeyword, setDeviceKeyword] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadScripts = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchRepoScripts()
      setScripts(list)
    } catch (err) {
      console.error(err)
      message.error('加载脚本仓库失败')
    } finally {
      setLoading(false)
    }
  }, [])

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
    void loadScripts()
    void loadDevices()
  }, [loadScripts, loadDevices])

  const handleOpenNew = useCallback(() => {
    setEditPath('')
    setEditContent('')
    setEditVisible(true)
  }, [])

  const handleOpenEdit = useCallback(async (item: RepoScriptItem) => {
    setEditPath(item.path)
    setEditVisible(true)
    setEditLoading(true)
    try {
      const { content } = await fetchRepoScriptContent(item.path)
      setEditContent(content)
    } catch (err) {
      console.error(err)
      message.error('加载脚本内容失败')
      setEditVisible(false)
    } finally {
      setEditLoading(false)
    }
  }, [])

  const handleSaveScript = useCallback(async () => {
    const path = editPath.trim()
    if (!path) {
      message.warning('请输入脚本路径，例如 demo/test.js')
      return
    }
    setEditLoading(true)
    try {
      await updateRepoScriptContent(path, editContent)
      message.success('脚本已保存到仓库')
      setEditVisible(false)
      setEditPath('')
      setEditContent('')
      void loadScripts()
    } catch (err) {
      console.error(err)
      message.error('保存脚本失败')
    } finally {
      setEditLoading(false)
    }
  }, [editPath, editContent, loadScripts])

  const handleDeleteScript = useCallback((item: RepoScriptItem) => {
    Modal.confirm({
      title: '确认删除脚本',
      content: `确定要删除脚本 ${item.path} 吗？该操作不可恢复。`,
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteRepoScript(item.path)
          message.success('脚本已删除')
          void loadScripts()
        } catch (err) {
          console.error(err)
          message.error('删除脚本失败')
        }
      },
    })
  }, [loadScripts])

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

  const handleBatchPush = useCallback(async () => {
    if (!targetDeviceIds.length) {
      message.warning('请选择目标设备')
      return
    }
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要推送的脚本')
      return
    }
    const paths = scripts.filter((s) => selectedRowKeys.includes(s.path)).map((s) => s.path)
    if (paths.length === 0) {
      message.warning('未找到要推送的脚本')
      return
    }
    setPushing(true)
    try {
      for (const deviceId of targetDeviceIds) {
        for (const p of paths) {
          await pushScriptToDevice(deviceId, { path: p, runImmediately })
        }
      }
      Modal.success({
        title: '批量推送完成',
        content: `已向 ${targetDeviceIds.length} 台设备推送 ${paths.length} 个脚本`,
      })
    } catch (err) {
      console.error(err)
      message.error('批量推送过程中出现错误，请检查部分设备或脚本')
    } finally {
      setPushing(false)
    }
  }, [targetDeviceIds, selectedRowKeys, scripts, runImmediately])

  const columns: ColumnsType<RepoScriptItem> = useMemo(
    () => [
      {
        title: '路径',
        dataIndex: 'path',
        key: 'path',
      },
      {
        title: '文件名',
        dataIndex: 'name',
        key: 'name',
        width: 200,
      },
      {
        title: '大小',
        dataIndex: 'size',
        key: 'size',
        width: 120,
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
        title: '操作',
        key: 'actions',
        width: 200,
        render: (_value, record) => (
          <Space>
            <Button type="link" size="small" onClick={() => void handleOpenEdit(record)}>
              编辑
            </Button>
            <Button type="link" size="small" danger onClick={() => handleDeleteScript(record)}>
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [handleOpenEdit, handleDeleteScript],
  )

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    preserveSelectedRowKeys: true,
  }

  return (
    <Card className="page-card" title="脚本管理（服务端仓库）">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => void loadScripts()} loading={loading}>
            刷新
          </Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={handleOpenNew}>
            新建脚本
          </Button>
          <Button
            icon={<UploadOutlined />}
            onClick={() => fileInputRef.current?.click()}
          >
            从本地上传脚本
          </Button>
          <input
            type="file"
            accept=".js,.ts"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const text = await file.text()
                setEditPath(file.name)
                setEditContent(text)
                setEditVisible(true)
              } catch (err) {
                console.error(err)
                message.error('读取本地脚本失败')
              }
            }}
          />
          <Space>
            <Button onClick={() => setDeviceModalVisible(true)} disabled={devicesLoading || !devices.length}>
              {targetDeviceIds.length > 0
                ? `已选择 ${targetDeviceIds.length} 台设备`
                : '选择目标设备（可多选）'}
            </Button>
            <Checkbox checked={runImmediately} onChange={(e) => setRunImmediately(e.target.checked)}>
              推送后立即运行
            </Checkbox>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => void handleBatchPush()}
              loading={pushing}
              disabled={!devices.length}
            >
              批量推送选中脚本到选中设备
            </Button>
          </Space>
        </Space>
        {scripts.length === 0 && !loading ? (
          <Empty description="脚本仓库为空" />
        ) : (
          <Table
            rowKey={(record) => record.path}
            columns={columns}
            dataSource={scripts}
            loading={loading}
            pagination={{ pageSize: 10 }}
            bordered
            rowSelection={rowSelection}
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
          <Input
            placeholder="关键字搜索设备（ID / 型号 / 厂商 / 备注）"
            allowClear
            value={deviceKeyword}
            onChange={(e) => setDeviceKeyword(e.target.value)}
          />
          <Table
            rowKey={(record) => record.deviceId}
            columns={[
              { title: '设备 ID', dataIndex: 'deviceId', key: 'deviceId', width: 220 },
              { title: '设备型号', dataIndex: 'model', key: 'model', render: (v?: string) => v ?? '-' },
              { title: '备注', dataIndex: 'remark', key: 'remark', render: (v?: string) => v ?? '-' },
              { title: '系统版本', dataIndex: 'androidVersion', key: 'androidVersion', render: (v?: string) => v ?? '-' },
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
      <Modal
        open={editVisible}
        title={editPath ? `编辑脚本 - ${editPath}` : '新建脚本'}
        onCancel={() => {
          setEditVisible(false)
          setEditPath('')
          setEditContent('')
        }}
        onOk={() => void handleSaveScript()}
        confirmLoading={editLoading}
        okText="保存"
        cancelText="取消"
        width={800}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input
            placeholder="脚本在仓库中的相对路径，例如 demo/test.js"
            value={editPath}
            onChange={(e) => setEditPath(e.target.value)}
          />
          <TextArea
            rows={18}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            spellCheck={false}
          />
        </Space>
      </Modal>
    </Card>
  )
}
