import { Router } from 'express'
import { config, updateAdminCredentials } from '../config'
import { getLockInfo, isLocked, issueToken, recordFailure, recordSuccess, revokeToken, verifyToken } from '../store/authStore'

export const authRouter = Router()

authRouter.get('/status', (_req, res) => {
  const info = getLockInfo()
  res.json(info)
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
    return res.json({ token })
  } else {
    recordFailure()
    const info = getLockInfo()
    return res.status(401).json({ message: 'invalid credentials', ...info })
  }
})

authRouter.post('/logout', (req, res) => {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  revokeToken(token)
  res.json({ ok: true })
})

authRouter.post('/change', (req, res) => {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
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