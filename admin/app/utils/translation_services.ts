import { SERVICE_NAMES } from '../../constants/service_names.js'

export const TRANSLATION_MODEL_LANGUAGES = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ar', 'ru', 'hi']

export type TranslationServiceDefinition = {
  service_name: string
  friendly_name: string
  powered_by: string
  display_order: number
  description: string
  icon: string
  container_image: string
  source_repo: string
  container_command: string
  container_config: string
  ui_location: string
  metadata: string
  installed: boolean
  installation_status: 'idle'
  is_dependency_service: boolean
  depends_on: string | null
}

export function getTranslationServiceDefinition(storagePath: string): TranslationServiceDefinition {
  return {
    service_name: SERVICE_NAMES.TRANSLATION,
    friendly_name: 'Offline Translation',
    powered_by: 'LibreTranslate / Argos Translate',
    display_order: 14,
    description: 'Optional local translation for copied map labels and offline wiki articles',
    icon: 'IconWorld',
    container_image: 'libretranslate/libretranslate:v1.9.6',
    source_repo: 'https://github.com/LibreTranslate/LibreTranslate',
    container_command: `--host 0.0.0.0 --port 5000 --load-only ${TRANSLATION_MODEL_LANGUAGES.join(',')} --disable-web-ui`,
    container_config: JSON.stringify({
      HostConfig: {
        RestartPolicy: { Name: 'unless-stopped' },
        Binds: [`${storagePath}/translation:/home/libretranslate/.local`],
        PortBindings: { '5000/tcp': [{ HostPort: '8403' }] },
      },
      ExposedPorts: { '5000/tcp': {} },
    }),
    ui_location: '/settings/translation',
    metadata: JSON.stringify({
      category: 'language',
      protocol: 'http',
      endpoint: '/translate',
      languages: TRANSLATION_MODEL_LANGUAGES,
      engine: 'Argos Translate',
    }),
    installed: false,
    installation_status: 'idle',
    is_dependency_service: false,
    depends_on: null,
  }
}
