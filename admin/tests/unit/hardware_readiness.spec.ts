import { test } from '@japa/runner'
import { buildHardwareReadiness } from '../../app/utils/hardware_readiness.js'

function systemInfo(overrides: Record<string, unknown> = {}) {
  return {
    mem: { total: 16 * 1024 ** 3, available: 8 * 1024 ** 3 },
    disk: [
      {
        name: 'nvme0n1',
        model: 'Test SSD',
        vendor: 'Test',
        rota: false,
        tran: 'nvme',
        size: `${512 * 1024 ** 3}`,
        totalUsed: 100 * 1024 ** 3,
        totalSize: 512 * 1024 ** 3,
        percentUsed: 19.5,
        health: { status: 'passed' as const, source: 'smartctl' as const },
        filesystems: [
          {
            fs: '/dev/nvme0n1p1',
            mount: '/storage',
            used: 100 * 1024 ** 3,
            size: 512 * 1024 ** 3,
            percentUsed: 19.5,
          },
        ],
      },
    ],
    fsSize: [],
    graphics: {
      controllers: [
        { model: 'Test GPU', vendor: 'NVIDIA', vram: 8192, vramDynamic: false, bus: '' },
      ],
      displays: [],
    },
    gpuHealth: { status: 'ok' as const, hasNvidiaRuntime: true, ollamaGpuAccessible: true },
    ...overrides,
  } as any
}

test.group('hardware readiness', () => {
  test('scores healthy storage, RAM, and GPU for first boot', ({ assert }) => {
    const readiness = buildHardwareReadiness(systemInfo())

    assert.equal(readiness.status, 'ready')
    assert.isAtLeast(readiness.score || 0, 75)
    assert.equal(readiness.checks.find((check) => check.id === 'storage')?.status, 'ready')
    assert.equal(readiness.checks.find((check) => check.id === 'memory')?.value, '16 GB')
    assert.include(readiness.checks.find((check) => check.id === 'gpu')?.value || '', '8.0 GB VRAM')
  })

  test('surfaces actionable warnings for failed storage and constrained hardware', ({ assert }) => {
    const readiness = buildHardwareReadiness(
      systemInfo({
        mem: { total: 2 * 1024 ** 3, available: 512 * 1024 ** 2 },
        disk: [
          {
            ...systemInfo().disk[0],
            health: { status: 'failed' as const, source: 'smartctl' as const },
          },
        ],
        graphics: { controllers: [], displays: [] },
        gpuHealth: {
          status: 'no_gpu' as const,
          hasNvidiaRuntime: false,
          ollamaGpuAccessible: false,
        },
      }),
      { projectedStorageBytes: 450 * 1024 ** 3 }
    )

    assert.equal(readiness.status, 'attention')
    assert.equal(readiness.checks.find((check) => check.id === 'storage')?.score, 0)
    assert.isAtLeast(readiness.suggestions.length, 4)
    assert.isTrue(readiness.suggestions.some((suggestion) => suggestion.includes('Back up')))
    assert.isTrue(
      readiness.suggestions.some((suggestion) => suggestion.includes('compact AI models'))
    )
  })

  test('does not treat unavailable SMART data as a failed disk', ({ assert }) => {
    const readiness = buildHardwareReadiness(
      systemInfo({
        disk: [{ ...systemInfo().disk[0], health: { status: 'unknown' as const } }],
      })
    )

    const storage = readiness.checks.find((check) => check.id === 'storage')
    assert.equal(storage?.status, 'unknown')
    assert.notEqual(storage?.score, 0)
    assert.isTrue(
      readiness.suggestions.some((suggestion) =>
        suggestion.includes('SMART health could not be read')
      )
    )
  })
})
