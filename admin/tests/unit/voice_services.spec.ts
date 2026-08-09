import { test } from '@japa/runner'
import { getVoiceServiceDefinitions } from '../../app/utils/voice_services.js'

test.group('voice service definitions', () => {
  test('defines persistent HTTP and Wyoming endpoints', ({ assert }) => {
    const services = getVoiceServiceDefinitions('/opt/project-nomad/storage')
    const whisper = services.find((service) => service.service_name === 'nomad_whisper_cpp')!
    const piper = services.find((service) => service.service_name === 'nomad_piper')!
    const whisperConfig = JSON.parse(whisper.container_config)
    const piperConfig = JSON.parse(piper.container_config)

    assert.deepEqual(
      services.map((service) => service.service_name),
      ['nomad_whisper_cpp', 'nomad_piper']
    )
    assert.include(whisper.container_image, 'whisper.cpp')
    assert.include(whisper.container_command, 'ggml-base.en.bin')
    assert.deepEqual(whisperConfig.HostConfig.PortBindings['8080/tcp'], [{ HostPort: '8400' }])
    assert.include(whisperConfig.HostConfig.Binds[0], '/whisper:/models')
    assert.equal(JSON.parse(whisper.metadata).endpoint, '/inference')

    assert.equal(piper.container_image, 'rhasspy/wyoming-piper:2.3.1')
    assert.include(piper.container_command, '--voice en_US-lessac-medium')
    assert.deepEqual(piperConfig.HostConfig.PortBindings['10200/tcp'], [{ HostPort: '8402' }])
    assert.deepEqual(piperConfig.HostConfig.PortBindings['5000/tcp'], [{ HostPort: '8401' }])
    assert.equal(JSON.parse(piper.metadata).protocol, 'wyoming')
  })
})
