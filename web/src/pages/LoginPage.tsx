import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Input, Space, Typography, message } from 'antd'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ locked: boolean; lockedUntil?: number; remainingAttempts?: number } | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const mod = await import('../api/auth')
      const info = await mod.getAuthStatus()
      setStatus(info)
    } catch {}
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const handleLogin = useCallback(async () => {
    setLoading(true)
    try {
      const mod = await import('../api/auth')
      const token = await mod.login(username.trim(), password.trim())
      localStorage.setItem('adminToken', token)
      const from = (location.state as any)?.from || '/devices'
      navigate(from, { replace: true })
      message.success('登录成功')
    } catch (err: any) {
      const text = String(err?.message || '')
      if (text.includes('locked')) message.error('已锁定，请稍后重试')
      else message.error('登录失败')
      void loadStatus()
    } finally {
      setLoading(false)
    }
  }, [username, password, navigate, location, loadStatus])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card title="管理员登录" style={{ width: 360 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {status?.locked ? (
            <Alert type="error" showIcon message="登录已锁定" description={`解锁时间：${status.lockedUntil ? new Date(status.lockedUntil).toLocaleString() : ''}`} />
          ) : (
            <Alert type="info" showIcon message="登录提示" description={<Typography.Text>剩余可错误次数：{status?.remainingAttempts ?? 20}</Typography.Text>} />
          )}
          <Input placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
          <Input.Password placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="primary" block onClick={handleLogin} loading={loading} disabled={!!status?.locked}>登录</Button>
        </Space>
      </Card>
    </div>
  )
}