import { Layout, Typography, Menu } from 'antd'
import type { ReactElement } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import './App.css'
import { DeviceListPage } from './pages/DeviceListPage'
import { DeviceDetailPage } from './pages/DeviceDetailPage'
import { RemoteControlPage } from './pages/RemoteControlPage'
import { ScriptRepoPage } from './pages/ScriptRepoPage'
import { SettingsPage } from './pages/SettingsPage'
import { SoftwareDistributionPage } from './pages/SoftwareDistributionPage'
import { ScreenWallPage } from './pages/ScreenWallPage'
import LoginPage from './pages/LoginPage'

const { Header, Sider, Content, Footer } = Layout
const { Title, Text } = Typography

function AppLayout() {
  const location = useLocation()

  const selectedKey = location.pathname.startsWith('/screen-wall')
    ? 'screen-wall'
    : location.pathname.startsWith('/distribution')
    ? 'distribution'
    : location.pathname.startsWith('/scripts')
    ? 'scripts'
    : location.pathname.startsWith('/settings')
    ? 'settings'
    : 'devices'

  return (
    <Layout className="app-layout">
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{ padding: '16px', color: '#fff', fontWeight: 600 }}>AutoJs6</div>
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]}>
          <Menu.Item key="devices">
            <Link to="/devices">设备管理</Link>
          </Menu.Item>
          <Menu.Item key="screen-wall">
            <Link to="/screen-wall">屏幕墙</Link>
          </Menu.Item>
          <Menu.Item key="distribution">
            <Link to="/distribution">软件分发</Link>
          </Menu.Item>
          <Menu.Item key="scripts">
            <Link to="/scripts">脚本管理</Link>
          </Menu.Item>
          <Menu.Item key="settings">
            <Link to="/settings">设置</Link>
          </Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <Header className="app-header">
          <Title level={3} className="app-title">
            <Link to="/devices">AutoJs6 设备管理平台</Link>
          </Title>
        </Header>
        <Content className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/devices" replace />} />
            <Route path="/devices" element={<DeviceListPage />} />
            <Route path="/devices/:deviceId" element={<DeviceDetailPage />} />
            <Route path="/devices/:deviceId/apps" element={<DeviceDetailPage />} />
            <Route path="/devices/:deviceId/remote" element={<RemoteControlPage />} />
            <Route path="/screen-wall" element={<ScreenWallPage />} />
            <Route path="/distribution" element={<SoftwareDistributionPage />} />
            <Route path="/scripts" element={<ScriptRepoPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/devices" replace />} />
          </Routes>
        </Content>
        <Footer className="app-footer">
          <Text type="secondary">后端接口：/api/devices · WebSocket：/ws/device</Text>
        </Footer>
      </Layout>
    </Layout>
  )
}

function App() {
  function RequireAuth({ children }: { children: ReactElement }) {
    const token = localStorage.getItem('adminToken')
    const location = useLocation()
    if (!token) {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />
    }
    return children
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<RequireAuth><AppLayout /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
