import { Router } from 'express'
import { config } from '../config'
import { ScriptRepo } from '../utils/repo'

const repo = new ScriptRepo(config.scriptsRepoRoot)

export const repoRouter = Router()

repoRouter.get('/scripts', (_req, res) => {
  try {
    const scripts = repo.list()
    res.json({ scripts })
  } catch (err) {
    console.error('[repo] failed to list scripts', err)
    res.status(500).json({ message: 'Failed to list scripts' })
  }
})

repoRouter.get('/scripts/content', (req, res) => {
  const relPath = (req.query.path as string | undefined)?.trim()
  if (!relPath) {
    return res.status(400).json({ message: 'path query is required' })
  }
  try {
    const { content, item } = repo.read(relPath)
    res.json({ item, content })
  } catch (err) {
    console.error('[repo] failed to read script', relPath, err)
    res.status(404).json({ message: 'Script not found' })
  }
})

repoRouter.post('/scripts/content', (req, res) => {
  const relPath = (req.body?.path as string | undefined)?.trim()
  const content = req.body?.content as string | undefined
  if (!relPath || typeof content !== 'string') {
    return res.status(400).json({ message: 'path and content are required' })
  }
  try {
    const item = repo.write(relPath, content)
    res.json({ item, content })
  } catch (err) {
    console.error('[repo] failed to write script', relPath, err)
    res.status(500).json({ message: 'Failed to write script' })
  }
})

repoRouter.delete('/scripts/content', (req, res) => {
  const relPath = (req.query.path as string | undefined)?.trim()
  if (!relPath) {
    return res.status(400).json({ message: 'path query is required' })
  }
  try {
    repo.delete(relPath)
    res.json({ message: 'Script deleted' })
  } catch (err) {
    console.error('[repo] failed to delete script', relPath, err)
    res.status(404).json({ message: 'Script not found' })
  }
})
