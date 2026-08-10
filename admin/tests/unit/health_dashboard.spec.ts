import { test } from '@japa/runner'
import { calculateContainerMemoryUsage } from '../../app/utils/health_dashboard.js'

test.group('health dashboard utilities', () => {
  test('subtracts the Linux page cache from container memory usage', ({ assert }) => {
    const usage = calculateContainerMemoryUsage({
      usage: 512 * 1024 * 1024,
      limit: 1024 * 1024 * 1024,
      stats: { cache: 128 * 1024 * 1024 },
    })

    assert.equal(usage.memoryBytes, 384 * 1024 * 1024)
    assert.equal(usage.memoryLimitBytes, 1024 * 1024 * 1024)
    assert.equal(usage.memoryPercent, 37.5)
  })

  test('handles missing or invalid Docker memory limits safely', ({ assert }) => {
    assert.deepEqual(calculateContainerMemoryUsage(null), {
      memoryBytes: 0,
      memoryLimitBytes: null,
      memoryPercent: null,
    })
    assert.equal(calculateContainerMemoryUsage({ usage: 10, limit: 0 }).memoryPercent, null)
  })
})
