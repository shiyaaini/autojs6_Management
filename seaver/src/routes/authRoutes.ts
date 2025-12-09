import { Router } from 'express'
import { config, updateAdminCredentials } from '../config'
import { getLockInfo, isLocked, issueToken, recordFailure, recordSuccess, revokeToken, verifyToken } from '../store/authStore'

export const authRouter = Router()

authRouter.get('/status', (req, res) => {
  const info = getLockInfo()
  const cookie = req.headers.cookie || ''
  const token = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('admin_token='))?.split('=')[1]
  const authenticated = verifyToken(token)
  res.json({ ...info, authenticated })
})

authRouter.post('/login', (req, res) => {
  if (isLocked()) {
    const info = getLockInfo()
    return res.status(403).json({ message: 'locked', ...info })
  }
  const { username, password } = req.body as { username?: string; password?: string }
  if (!username || !password) {
    return res.status(400).json({ message: 'username and password are required' })
  }
  if (username === config.adminUsername && password === config.adminPassword) {
    recordSuccess()
    const token = issueToken()
    res.cookie('admin_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    })
    return res.json({ token })
  } else {
    recordFailure()
    const info = getLockInfo()
    return res.status(401).json({ message: 'invalid credentials', ...info })
  }
})

authRouter.post('/logout', (req, res) => {
  const cookie = req.headers.cookie || ''
  const token = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('admin_token='))?.split('=')[1]
  revokeToken(token)
  res.clearCookie('admin_token', { path: '/' })
  res.json({ ok: true })
})

authRouter.post('/change', (req, res) => {
  const cookie = req.headers.cookie || ''
  const token = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('admin_token='))?.split('=')[1]
  if (!verifyToken(token)) {
    return res.status(401).json({ message: 'unauthorized' })
  }
  const { username, password, currentPassword } = req.body as { username?: string; password?: string; currentPassword?: string }
  if (!username || !password || !currentPassword) {
    return res.status(400).json({ message: 'username, password and currentPassword are required' })
  }
  if (currentPassword !== config.adminPassword) {
    return res.status(401).json({ message: 'invalid currentPassword' })
  }
  updateAdminCredentials(username, password)
  res.json({ username: config.adminUsername })
})