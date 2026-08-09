import { test } from '@japa/runner'
import { buildStarterPackStatuses } from '../../app/utils/starter_packs.js'
import type { SpecCategory } from '../../types/collections.js'

const categories: SpecCategory[] = [
  {
    slug: 'medicine',
    name: 'Medicine',
    description: '',
    icon: 'IconStethoscope',
    language: 'en',
    tiers: [
      {
        slug: 'medicine-essential',
        name: 'Essential',
        description: '',
        resources: [
          {
            id: 'first-aid',
            version: '1',
            title: 'First aid',
            description: '',
            url: 'https://example.com/first-aid.zim',
            size_mb: 10,
          },
        ],
      },
    ],
  },
]

test.group('starter pack catalog', () => {
  test('resolves pack resources and installed counts from categories', ({ assert }) => {
    const [pack] = buildStarterPackStatuses(categories, new Set(['first-aid']), [
      {
        id: 'medical',
        name: 'Medical',
        description: 'Medical references',
        icon: 'IconStethoscope',
        selections: [{ categorySlug: 'medicine', tierSlug: 'medicine-essential' }],
      },
    ])

    assert.isTrue(pack.available)
    assert.equal(pack.resource_count, 1)
    assert.equal(pack.installed_count, 1)
    assert.equal(pack.size_mb, 10)
  })

  test('marks a pack unavailable when a referenced tier is absent', ({ assert }) => {
    const [pack] = buildStarterPackStatuses(categories, new Set(), [
      {
        id: 'ham-radio',
        name: 'HAM Radio',
        description: 'Radio references',
        icon: 'IconWorld',
        selections: [{ categorySlug: 'radio', tierSlug: 'radio-essential' }],
      },
    ])

    assert.isFalse(pack.available)
    assert.equal(pack.resource_count, 0)
  })
})
