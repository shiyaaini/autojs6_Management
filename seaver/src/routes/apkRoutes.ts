import express, { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { config } from '../config'

export const apkRouter = Router()

interface ApkItem {
  name: string
  path: string
  size: number
  updatedAt: number
}

const apkRoot = config.apkRepoRoot

function listApkFiles(): ApkItem[] {
  if (!fs.existsSync(apkRoot)) {
    return []
  }
  const items: ApkItem[] = []
  const entries = fs.readdirSync(apkRoot, { withFileTypes: true })
  for (const ent of entries) {
    if (!ent.isFile()) continue
    const ext = path.extname(ent.name).toLowerCase()
    if (ext !== '.apk') continue
    const full = path.join(apkRoot, ent.name)
    const stat = fs.statSync(full)
    items.push({
      name: ent.name,
      path: ent.name,
      size: stat.size,
      updatedAt: stat.mtimeMs,
    })
  }
  items.sort((a, b) => a.name.localeCompare(b.name))
  return items
}

apkRouter.get('/list', (_req, res) => {
  try {
    const items = listApkFiles()
    res.json({ items })
  } catch (err) {
    console.error('[apk] failed to list apks', err)
    res.status(500).json({ message: 'Failed to list APKs' })
  }
})

apkRouter.post(
  '/upload',
  express.raw({ type: 'application/octet-stream', limit: '200mb' }),
  (req, res) => {
    const filenameRaw = (req.query.filename as string | undefined) ?? ''
    const filename = filenameRaw.trim()
    if (!filename) {
      return res.status(400).json({ message: 'filename query is required' })
    }
    if (!Buffer.isBuffer(req.body) || (req.body as Buffer).length === 0) {
      return res.status(400).json({ message: 'empty body' })
    }

    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_')
    const target = path.join(apkRoot, safeName)

    try {
      if (!fs.existsSync(apkRoot)) {
        fs.mkdirSync(apkRoot, { recursive: true })
      }
      fs.writeFileSync(target, req.body as Buffer)
      const stat = fs.statSync(target)
      const item: ApkItem = {
        name: safeName,
        path: safeName,
        size: stat.size,
        updatedAt: stat.mtimeMs,
      }
      res.json({ item })
    } catch (err) {
      console.error('[apk] failed to save apk', filename, err)
      res.status(500).json({ message: 'Failed to save APK' })
    }
  },
)

apkRouter.get('/files/:name', (req, res) => {
  const name = (req.params.name ?? '').trim()
  if (!name) {
    return res.status(400).json({ message: 'name param is required' })
  }
  const safeName = path.basename(name)
  const full = path.join(apkRoot, safeName)
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return res.status(404).json({ message: 'APK not found' })
  }
  res.sendFile(full)
})
