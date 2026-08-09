import { test } from '@japa/runner'
import { CACHE_DEFINITIONS } from '../../app/utils/developer_caches.js'

test.group('developer cache catalog', () => {
  test('exposes one persistent proxy for each package ecosystem', ({ assert }) => {
    assert.deepEqual(
      CACHE_DEFINITIONS.map((cache) => cache.id),
      ['npm', 'pypi', 'docker']
    )
    assert.include(CACHE_DEFINITIONS.find((cache) => cache.id === 'npm')!.setup_command, '4873')
    assert.include(CACHE_DEFINITIONS.find((cache) => cache.id === 'pypi')!.setup_command, '3141')
    assert.include(CACHE_DEFINITIONS.find((cache) => cache.id === 'docker')!.setup_command, '5000')
  })
})
