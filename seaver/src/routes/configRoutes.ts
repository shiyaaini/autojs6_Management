import { Router } from 'express'
import { config } from '../config'

export const configRouter = Router()

configRouter.get('/secret', (_req, res) => {
  res.json({ matchCode: config.matchCode })
})

configRouter.post('/secret', (req, res) => {
  const { matchCode } = req.body as { matchCode?: string }
  if (!matchCode || typeof matchCode !== 'string') {
    return res.status(400).json({ message: 'matchCode is required' })
  }
  config.matchCode = matchCode
  return res.json({ matchCode: config.matchCode })
})
