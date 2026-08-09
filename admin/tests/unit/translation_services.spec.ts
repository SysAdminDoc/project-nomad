import { test } from '@japa/runner'
import {
  getTranslationServiceDefinition,
  TRANSLATION_MODEL_LANGUAGES,
} from '../../app/utils/translation_services.js'
import { SERVICE_NAMES } from '../../constants/service_names.js'

test.group('translation service definition', () => {
  test('uses persistent model storage and a local API port', ({ assert }) => {
    const service = getTranslationServiceDefinition('/opt/project-nomad/storage')
    const config = JSON.parse(service.container_config)

    assert.equal(service.service_name, SERVICE_NAMES.TRANSLATION)
    assert.include(service.container_image, 'libretranslate/libretranslate:v1.9.6')
    assert.include(service.container_command, '--load-only')
    assert.include(
      config.HostConfig.Binds,
      '/opt/project-nomad/storage/translation:/home/libretranslate/.local'
    )
    assert.deepEqual(config.HostConfig.PortBindings['5000/tcp'], [{ HostPort: '8403' }])
  })

  test('keeps the selected language set explicit for predictable offline installs', ({
    assert,
  }) => {
    assert.deepEqual(TRANSLATION_MODEL_LANGUAGES, [
      'en',
      'es',
      'fr',
      'de',
      'pt',
      'zh',
      'ar',
      'ru',
      'hi',
    ])
  })
})
