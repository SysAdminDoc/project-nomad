import { test } from '@japa/runner'
import {
  buildClusterResourceKey,
  isSafeClusterFilename,
  normalizeClusterUrl,
} from '../../app/utils/cluster.js'

test.group('cluster utilities', () => {
  test('normalizes HTTP cluster URLs and strips query state', ({ assert }) => {
    assert.equal(
      normalizeClusterUrl('http://nomad-peer.local:8080/?pair=1'),
      'http://nomad-peer.local:8080'
    )
    assert.throws(() => normalizeClusterUrl('file:///etc/passwd'))
    assert.throws(() => normalizeClusterUrl('https://user:password@nomad-peer.local'))
  })

  test('accepts only portable resource filenames', ({ assert }) => {
    assert.isTrue(isSafeClusterFilename('wikipedia_en_all.zim'))
    assert.isTrue(isSafeClusterFilename('north-america.pmtiles'))
    assert.isFalse(isSafeClusterFilename('../secrets.txt'))
    assert.isFalse(isSafeClusterFilename(''))
  })

  test('keeps resource type in selection keys', ({ assert }) => {
    assert.equal(buildClusterResourceKey('north-america', 'map'), 'map:north-america')
  })
})
