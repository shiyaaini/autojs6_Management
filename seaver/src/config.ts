import dotenv from 'dotenv'
dotenv.config()
import fs from 'fs'
import path from 'path'

const CONFIG_YAML_PATH = path.resolve(process.cwd(), 'config.yaml')

function readYamlKV(filePath: string): Record<string, string> {
  try {
    const text = fs.readFileSync(filePath, 'utf8')
    const lines = text.split(/\r?\n/)
    const kv: Record<string, string> = {}
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*:\s*(.*)\s*$/)
      if (!m) continue
      const key = m[1]
      let value = m[2]
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
      kv[key] = value
    }
    return kv
  } catch {
    return {}
  }
}

function writeYamlKV(filePath: string, data: Record<string, string>) {
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${String(v)}`)
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
}

function ensureAdminConfig(): { adminUsername: string; adminPassword: string } {
  if (!fs.existsSync(CONFIG_YAML_PATH)) {
    writeYamlKV(CONFIG_YAML_PATH, { adminUsername: 'admin', adminPassword: 'admin' })
  }
  const kv = readYamlKV(CONFIG_YAML_PATH)
  const adminUsername = kv.adminUsername || 'admin'
  const adminPassword = kv.adminPassword || 'admin'
  return { adminUsername, adminPassword }
}

const admin = ensureAdminConfig()

export const config = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  matchCode: process.env.MATCH_CODE ?? 'autojs6',
  scriptsRepoRoot: process.env.SCRIPTS_REPO_ROOT
    ? path.resolve(process.env.SCRIPTS_REPO_ROOT)
    : path.resolve(process.cwd(), 'all_scripts'),
  apkRepoRoot: process.env.APK_REPO_ROOT
    ? path.resolve(process.env.APK_REPO_ROOT)
    : path.resolve(process.cwd(), 'all_apk'),
  adminUsername: admin.adminUsername,
  adminPassword: admin.adminPassword,
}

export function updateAdminCredentials(username: string, password: string) {
  const u = username?.trim() || 'admin'
  const p = password?.trim() || 'admin'
  writeYamlKV(CONFIG_YAML_PATH, { adminUsername: u, adminPassword: p })
  ;(config as any).adminUsername = u
  ;(config as any).adminPassword = p
}
