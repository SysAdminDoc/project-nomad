import { test } from '@japa/runner'
import { getZimResourceIdentity, isNewerZimRelease } from '../../app/utils/zim_updates.js'

test.group('ZIM release comparison', () => {
  test('extracts a stable resource id and release version', ({ assert }) => {
    assert.deepEqual(getZimResourceIdentity('wikipedia_en_all_mini_2025-06.zim'), {
      resourceId: 'wikipedia_en_all_mini',
      version: '2025-06',
    })
  })

  test('only reports a newer release for the same resource', ({ assert }) => {
    assert.isTrue(
      isNewerZimRelease('wikipedia_en_all_mini_2025-06.zim', 'wikipedia_en_all_mini_2026-01.zim')
    )
    assert.isFalse(
      isNewerZimRelease('wikipedia_en_all_mini_2026-01.zim', 'wikipedia_en_all_mini_2025-06.zim')
    )
    assert.isFalse(isNewerZimRelease('wikipedia_en_all_mini_2025-06.zim', 'medicine_2026-01.zim'))
  })
})
