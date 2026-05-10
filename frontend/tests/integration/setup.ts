import * as fs from 'fs'
import * as path from 'path'

/**
 * Loads .env.test into process.env before integration tests run.
 * Falls back to .env if .env.test doesn't exist.
 */
export default async function globalSetup(): Promise<void> {
  const envFile = path.resolve(__dirname, '../../.env.test')
  const fallback = path.resolve(__dirname, '../../.env')
  const target = fs.existsSync(envFile) ? envFile : fallback

  if (!fs.existsSync(target)) return

  const lines = fs.readFileSync(target, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key   = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) {
      process.env[key] = value
    }
  }

  // Also map VITE_ prefixed keys so the test client can fall back to them
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('VITE_') && v) {
      const plain = k.replace(/^VITE_/, '')
      if (!process.env[plain]) process.env[plain] = v
    }
  }
}
