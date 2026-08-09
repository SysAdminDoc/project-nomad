import { test } from '@japa/runner'
import {
  CHAT_OWNER_COOKIE,
  ensureChatOwnerKey,
  isChatOwnerKey,
} from '../../app/utils/chat_privacy.js'

test.group('chat privacy owner keys', () => {
  test('accepts only UUID v4 owner keys', ({ assert }) => {
    assert.isTrue(isChatOwnerKey('123e4567-e89b-42d3-a456-426614174000'))
    assert.isFalse(isChatOwnerKey('shared-owner'))
    assert.isFalse(isChatOwnerKey(null))
  })

  test('reuses a valid encrypted-cookie value and creates one otherwise', ({ assert }) => {
    const valid = '123e4567-e89b-42d3-a456-426614174000'
    let stored: { key: string; value: string; options: Record<string, unknown> } | null = null
    const response = {
      encryptedCookie(key: string, value: string, options: Record<string, unknown>) {
        stored = { key, value, options }
      },
    }

    assert.equal(ensureChatOwnerKey({ encryptedCookie: () => valid }, response), valid)
    assert.isNull(stored)

    const ownerKey = ensureChatOwnerKey({ encryptedCookie: () => undefined }, response)
    assert.isTrue(isChatOwnerKey(ownerKey))
    assert.isNotNull(stored)
    const created = stored as unknown as {
      key: string
      value: string
      options: Record<string, unknown>
    }
    assert.equal(created.key, CHAT_OWNER_COOKIE)
    assert.equal(created.value, ownerKey)
    assert.equal(created.options.httpOnly, true)
  })
})
