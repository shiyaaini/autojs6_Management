import crypto from 'crypto'

let failedAttempts = 0
let lockUntil = 0
const tokens = new Map<string, number>()

export function isLocked() {
  return Date.now() < lockUntil
}

export function getLockInfo() {
  return { locked: isLocked(), lockedUntil: lockUntil || undefined, remainingAttempts: Math.max(0, 20 - failedAttempts) }
}

export function recordFailure() {
  failedAttempts += 1
  if (failedAttempts >= 20) {
    lockUntil = Date.now() + 6 * 60 * 60 * 1000
    failedAttempts = 0
  }
}

export function recordSuccess() {
  failedAttempts = 0
}

export function issueToken() {
  const token = crypto.randomBytes(32).toString('hex')
  tokens.set(token, Date.now() + 24 * 60 * 60 * 1000)
  return token
}

export function verifyToken(token: string | undefined) {
  if (!token) return false
  const exp = tokens.get(token)
  if (!exp) return false
  if (Date.now() > exp) {
    tokens.delete(token)
    return false
  }
  return true
}

export function revokeToken(token: string | undefined) {
  if (!token) return
  tokens.delete(token)
}