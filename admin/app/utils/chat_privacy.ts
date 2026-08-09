import { randomUUID } from 'node:crypto'

export const CHAT_OWNER_COOKIE = 'nomad_chat_owner'
const CHAT_OWNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type EncryptedCookieRequest = {
  encryptedCookie(key: string, defaultValue?: string): unknown
}

type EncryptedCookieResponse = {
  encryptedCookie(key: string, value: string, options: Record<string, unknown>): unknown
}

export function isChatOwnerKey(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

/**
 * Resolve the browser's opaque history owner and issue it on first contact.
 * The cookie is encrypted and HttpOnly; it is an identifier, not an account
 * or authentication credential.
 */
export function ensureChatOwnerKey(
  request: EncryptedCookieRequest,
  response: EncryptedCookieResponse
): string {
  const existing = request.encryptedCookie(CHAT_OWNER_COOKIE)
  if (isChatOwnerKey(existing)) return existing

  const ownerKey = randomUUID()
  response.encryptedCookie(CHAT_OWNER_COOKIE, ownerKey, {
    httpOnly: true,
    maxAge: CHAT_OWNER_COOKIE_MAX_AGE,
    sameSite: 'lax',
  })
  return ownerKey
}
