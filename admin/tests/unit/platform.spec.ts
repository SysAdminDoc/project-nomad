import { test } from '@japa/runner'
import {
  architectureLabel,
  isSupportedNomadArchitecture,
  normalizeArchitecture,
} from '../../app/utils/platform.js'

test.group('platform utilities', () => {
  test('normalizes common Docker, Node, and Debian architecture names', ({ assert }) => {
    assert.equal(normalizeArchitecture('x86_64'), 'amd64')
    assert.equal(normalizeArchitecture('aarch64'), 'arm64')
    assert.equal(normalizeArchitecture('armv7l'), 'arm')
    assert.equal(normalizeArchitecture('mips64'), 'mips64')
  })

  test('treats amd64 and arm64 as first-class supported targets', ({ assert }) => {
    assert.isTrue(isSupportedNomadArchitecture('amd64'))
    assert.isTrue(isSupportedNomadArchitecture('aarch64'))
    assert.isFalse(isSupportedNomadArchitecture('armv7l'))
    assert.equal(architectureLabel('arm64'), '64-bit ARM (ARM64)')
  })
})
