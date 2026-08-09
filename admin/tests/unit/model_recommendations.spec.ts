import { test } from '@japa/runner'
import {
  buildModelCatalogHardware,
  detectModelHardwareProfile,
  parseModelParameterBillions,
  parseModelSizeGb,
  recommendModelTag,
} from '../../app/utils/model_recommendations.js'
import type { ModelCatalogHardware, NomadOllamaModelTag } from '../../types/ollama.js'

const tag = (name: string, size: string): NomadOllamaModelTag => ({
  name,
  size,
  context: '128k',
  input: 'Text',
  cloud: false,
  thinking: false,
})

test.group('model recommendations', () => {
  test('detects the supported device families', ({ assert }) => {
    assert.equal(
      detectModelHardwareProfile({ cpuModel: 'Raspberry Pi 5 Model B', architecture: 'arm64' }),
      'raspberry-pi-5'
    )
    assert.equal(
      detectModelHardwareProfile({ cpuModel: 'NVIDIA Carmel ARMv8', architecture: 'arm64' }),
      'jetson'
    )
    assert.equal(
      detectModelHardwareProfile({
        cpuModel: 'AMD Ryzen 7 7700X',
        architecture: 'x86_64',
        gpuModels: [{ vendor: 'NVIDIA', model: 'GeForce RTX 4070', vramMb: 12288 }],
      }),
      'x86-nvidia'
    )
  })

  test('parses model parameter and download sizes', ({ assert }) => {
    assert.equal(parseModelParameterBillions('qwen2.5:1.5b'), 1.5)
    assert.equal(parseModelParameterBillions('llama3.1:8b-text-q4_1'), 8)
    assert.equal(parseModelParameterBillions('model:latest'), null)
    assert.closeTo(parseModelSizeGb('581 MB') || 0, 0.581, 0.0001)
    assert.equal(parseModelSizeGb('unknown'), null)
  })

  test('recommends a small model for a Pi and flags a large one', ({ assert }) => {
    const hardware = buildModelCatalogHardware({
      cpu: { brand: 'Raspberry Pi 5 Model B' } as never,
      os: { arch: 'arm64' } as never,
      mem: { total: 8 * 1024 ** 3 } as never,
      graphics: { controllers: [] } as never,
    })

    const small = recommendModelTag(tag('llama3.2:3b', '2.0 GB'), hardware)
    const large = recommendModelTag(tag('llama3.1:70b', '40 GB'), hardware)

    assert.equal(hardware.profile, 'raspberry-pi-5')
    assert.isTrue(small.recommended)
    assert.equal(small.tier, 'recommended')
    assert.equal(large.tier, 'not-recommended')
  })

  test('uses GPU memory when recommending for x86 NVIDIA hosts', ({ assert }) => {
    const hardware: ModelCatalogHardware = {
      profile: 'x86-nvidia',
      label: 'x86 + NVIDIA GPU',
      cpuModel: 'Intel Core i9',
      gpuModel: 'NVIDIA RTX',
      ramGb: 32,
      vramGb: 12,
    }

    const model = recommendModelTag(tag('qwen2.5:14b', '9 GB'), hardware)

    assert.equal(model.tier, 'recommended')
    assert.include(model.reason, 'runtime memory')
  })
})
