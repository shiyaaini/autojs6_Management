import fs from 'fs'
import path from 'path'

export interface RepoScriptItem {
  path: string // relative path from repo root
  name: string
  size: number
  updatedAt: number
}

export class ScriptRepo {
  constructor(private repoRoot: string) {}

  list(extensionFilter: string[] = ['.js', '.ts']): RepoScriptItem[] {
    const out: RepoScriptItem[] = []
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const ent of entries) {
        const full = path.join(dir, ent.name)
        const rel = path.relative(this.repoRoot, full)
        if (ent.isDirectory()) {
          walk(full)
        } else {
          const ext = path.extname(ent.name).toLowerCase()
          if (!extensionFilter.includes(ext)) continue
          const stat = fs.statSync(full)
          out.push({
            path: rel.replace(/\\/g, '/'),
            name: ent.name,
            size: stat.size,
            updatedAt: stat.mtimeMs,
          })
        }
      }
    }
    walk(this.repoRoot)
    return out.sort((a, b) => a.path.localeCompare(b.path))
  }

  read(relPath: string): { content: string; item: RepoScriptItem } {
    const safeRel = relPath.replace(/^\.\/+/, '')
    const full = path.join(this.repoRoot, safeRel)
    const stat = fs.statSync(full)
    if (!stat.isFile()) throw new Error('Not a file')
    const content = fs.readFileSync(full, 'utf-8')
    return {
      content,
      item: {
        path: safeRel.replace(/\\/g, '/'),
        name: path.basename(full),
        size: stat.size,
        updatedAt: stat.mtimeMs,
      },
    }
  }

  delete(relPath: string): void {
    const safeRel = relPath.replace(/^\.\/+/, '')
    const full = path.join(this.repoRoot, safeRel)
    if (!fs.existsSync(full)) {
      throw new Error('Not found')
    }
    const stat = fs.statSync(full)
    if (!stat.isFile()) {
      throw new Error('Not a file')
    }
    fs.unlinkSync(full)
  }

  write(relPath: string, content: string): RepoScriptItem {
    const safeRel = relPath.replace(/^\.\/+/, '')
    const full = path.join(this.repoRoot, safeRel)
    const dir = path.dirname(full)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(full, content, 'utf-8')
    const stat = fs.statSync(full)
    return {
      path: safeRel.replace(/\\/g, '/'),
      name: path.basename(full),
      size: stat.size,
      updatedAt: stat.mtimeMs,
    }
  }
}
