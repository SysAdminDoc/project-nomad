import { test } from '@japa/runner'
import {
  buildGuestKioskConfig,
  buildGuestKioskTools,
  isGuestKioskRouteAllowed,
  isGuestKioskStaticPathAllowed,
  parseGuestKioskTools,
} from '../../app/utils/guest_kiosk.js'

test.group('guest kiosk utilities', () => {
  test('parses a safe default and ignores unknown tools', ({ assert }) => {
    assert.deepEqual(parseGuestKioskTools(undefined), ['chat', 'maps', 'docs'])
    assert.deepEqual(parseGuestKioskTools('maps,unknown,maps'), ['maps'])
    assert.isTrue(buildGuestKioskConfig('true', 'docs').enabled)
    assert.isFalse(buildGuestKioskConfig('false', 'docs').enabled)
  })

  test('only allows routes belonging to selected tools', ({ assert }) => {
    assert.isTrue(isGuestKioskRouteAllowed('/kiosk', 'GET', ['maps']))
    assert.isTrue(isGuestKioskRouteAllowed('/api/maps/styles', 'GET', ['maps']))
    assert.isFalse(isGuestKioskRouteAllowed('/chat', 'GET', ['maps']))
    assert.isFalse(isGuestKioskRouteAllowed('/api/system/info', 'GET', ['maps']))
    assert.isTrue(isGuestKioskRouteAllowed('/api/health', 'GET', []))
  })

  test('only exposes map data files when maps are enabled', ({ assert }) => {
    assert.isTrue(isGuestKioskStaticPathAllowed('/assets/app.js', []))
    assert.isTrue(isGuestKioskStaticPathAllowed('/pmtiles/region.pmtiles', ['maps']))
    assert.isFalse(isGuestKioskStaticPathAllowed('/pmtiles/region.pmtiles', ['docs']))
  })

  test('builds public tiles from enabled installed services', ({ assert }) => {
    const tools = buildGuestKioskTools(
      ['kiwix', 'docs'],
      [
        {
          service_name: 'nomad_kiwix_server',
          friendly_name: 'Information Library',
          description: 'Offline books',
          icon: 'IconBooks',
          ui_location: '8090',
        },
      ]
    )

    assert.lengthOf(tools, 2)
    assert.equal(tools[0].href, '8090')
    assert.equal(tools[0].target, '_blank')
    assert.equal(tools[1].href, '/docs/home')
  })
})
