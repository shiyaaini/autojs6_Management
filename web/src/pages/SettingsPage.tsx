import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Space, Table, Tag, Typography, Input, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined } from '@ant-design/icons'
import { fetchDevices } from '../api/devices'
import { fetchMatchCode, updateMatchCode } from '../api/config'
import type { Device } from '../types'

const statusColorMap: Record<Device['status'], string> = {
  online: 'green',
  offline: 'red',
}

const { Text } = Typography

export function SettingsPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [matchCode, setMatchCode] = useState<string>('')
  const [matchCodeLoading, setMatchCodeLoading] = useState(true)
  const [newMatchCode, setNewMatchCode] = useState<string>('')
  const [savingMatchCode, setSavingMatchCode] = useState(false)
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem('adminToken'))
  const [authStatus, setAuthStatus] = useState<{ locked: boolean; lockedUntil?: number; remainingAttempts?: number; authenticated?: boolean } | null>(null)
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [changeUsername, setChangeUsername] = useState('')
  const [changePassword, setChangePassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [changeLoading, setChangeLoading] = useState(false)

  const loadDevices = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchDevices()
      setDevices(list)
    } catch (err) {
      console.error(err)
      message.error('获取设备列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMatchCode = useCallback(async () => {
    setMatchCodeLoading(true)
    try {
      const code = await fetchMatchCode()
      setMatchCode(code)
    } catch (err) {
      console.error(err)
      message.warning('获取管理平台秘钥失败，请检查后端服务是否启动')
    } finally {
      setMatchCodeLoading(false)
    }
  }, [])

  const loadAuthStatus = useCallback(async () => {
    try {
      const mod = await import('../api/auth')
      const info = await mod.getAuthStatus()
      setAuthStatus(info)
    } catch (err) {
      setAuthStatus(null)
    }
  }, [])

  useEffect(() => {
    void loadDevices()
    void loadMatchCode()
    void loadAuthStatus()
  }, [loadDevices, loadMatchCode])

  const handleCopyMatchCode = useCallback(async () => {
    if (!matchCode) return
    try {
      await navigator.clipboard.writeText(matchCode)
      message.success('秘钥已复制到剪贴板')
    } catch (err) {
      console.error(err)
      message.warning('无法复制到剪贴板，请手动选择复制')
    }
  }, [matchCode])

  const handleSaveMatchCode = useCallback(async () => {
    const value = newMatchCode.trim()
    if (!value) {
      message.warning('请输入新的秘钥')
      return
    }
    setSavingMatchCode(true)
    try {
      const updated = await updateMatchCode(value)
      setMatchCode(updated)
      setNewMatchCode('')
      message.success('秘钥已更新，请在 Android 端同步修改')
    } catch (err) {
      console.error(err)
      message.error('更新秘钥失败')
    } finally {
      setSavingMatchCode(false)
    }
  }, [newMatchCode])

  const handleLogin = useCallback(async () => {
    setLoginLoading(true)
    try {
      const mod = await import('../api/auth')
      const token = await mod.login(loginUsername.trim(), loginPassword.trim())
      localStorage.setItem('adminToken', token)
      setAdminToken(token)
      setLoginUsername('')
      setLoginPassword('')
      message.success('管理员登录成功')
    } catch (err: any) {
      const text = String(err?.message || '')
      if (text.includes('locked')) message.error('已锁定，请稍后重试')
      else message.error('登录失败')
      void loadAuthStatus()
    } finally {
      setLoginLoading(false)
    }
  }, [loginUsername, loginPassword, loadAuthStatus])

  const handleLogout = useCallback(async () => {
    try {
      const mod = await import('../api/auth')
      await mod.logout()
    } catch {}
    localStorage.removeItem('adminToken')
    setAdminToken(null)
    message.success('已退出')
  }, [adminToken])

  const handleChangeAdmin = useCallback(async () => {
    const u = changeUsername.trim()
    const p = changePassword.trim()
    const c = currentPassword.trim()
    if (!u || !p || !c) {
      message.warning('请填写用户名、当前密码和新密码')
      return
    }
    if (!adminToken) {
      message.error('请先登录管理员')
      return
    }
    setChangeLoading(true)
    try {
      const mod = await import('../api/auth')
      await mod.changeAdminCredentials(u, p, c)
      setChangeUsername('')
      setChangePassword('')
      setCurrentPassword('')
      message.success('管理员账号密码已更新')
    } catch (err) {
      message.error('更新失败')
    } finally {
      setChangeLoading(false)
    }
  }, [changeUsername, changePassword, currentPassword, adminToken])

  const columns: ColumnsType<Device> = useMemo(
    () => [
      {
        title: '设备型号',
        dataIndex: 'model',
        key: 'model',
        render: (value?: string) => value ?? '-',
      },
      {
        title: '设备 ID',
        dataIndex: 'deviceId',
        key: 'deviceId',
        width: 240,
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
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        render: (value: Device['status']) => <Tag color={statusColorMap[value]}>{value === 'online' ? '在线' : '离线'}</Tag>,
      },
    ],
    [],
  )

  return (
    <Card className="page-card" title="系统设置">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          type="info"
          showIcon
          message="管理平台秘钥"
          description={
            matchCodeLoading ? (
              '加载中...'
            ) : (
              <Space direction="vertical" size="small">
                <Space size="small">
                  <Text code>{matchCode || '未配置（使用后端 MATCH_CODE）'}</Text>
                  {matchCode && (
                    <Button size="small" onClick={handleCopyMatchCode}>
                      复制
                    </Button>
                  )}
                </Space>
                <Space size="small">
                  <Input
                    size="small"
                    placeholder="输入新的秘钥，例如 autojs6-prod"
                    style={{ width: 260 }}
                    value={newMatchCode}
                    onChange={(e) => setNewMatchCode(e.target.value)}
                  />
                  <Button size="small" type="primary" loading={savingMatchCode} onClick={handleSaveMatchCode}>
                    保存
                  </Button>
                </Space>
              </Space>
            )
          }
        />
        <Alert
          type="warning"
          showIcon
          message="管理员设置"
          description={
            <Space direction="vertical" size="small">
              {adminToken ? (
                <Space direction="vertical" size="small">
                  <Space>
                    <Input size="small" placeholder="新的用户名" style={{ width: 200 }} value={changeUsername} onChange={(e) => setChangeUsername(e.target.value)} />
                    <Input.Password size="small" placeholder="新的密码" style={{ width: 200 }} value={changePassword} onChange={(e) => setChangePassword(e.target.value)} />
                    <Input.Password size="small" placeholder="当前密码" style={{ width: 200 }} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                    <Button size="small" type="primary" loading={changeLoading} onClick={handleChangeAdmin}>保存</Button>
                    <Button size="small" onClick={handleLogout}>退出登录</Button>
                  </Space>
                </Space>
              ) : (
                <Space direction="vertical" size="small">
                  {authStatus?.locked ? (
                    <Text type="danger">登录已锁定，解锁时间：{authStatus.lockedUntil ? new Date(authStatus.lockedUntil).toLocaleString() : ''}</Text>
                  ) : (
                    <Text>剩余可错误次数：{authStatus?.remainingAttempts ?? 20}</Text>
                  )}
                  <Space>
                    <Input size="small" placeholder="用户名" style={{ width: 200 }} value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} />
                    <Input.Password size="small" placeholder="密码" style={{ width: 200 }} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                    <Button size="small" type="primary" loading={loginLoading} onClick={handleLogin} disabled={!!authStatus?.locked}>登录</Button>
                  </Space>
                </Space>
              )}
            </Space>
          }
        />
        <Space style={{ marginTop: 8, marginBottom: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={() => void loadDevices()} loading={loading}>
            刷新设备列表
          </Button>
        </Space>
        <Table
          rowKey={(record) => record.deviceId}
          columns={columns}
          dataSource={devices}
          loading={loading}
          pagination={false}
          bordered
        />
      </Space>
    </Card>
  )
}
