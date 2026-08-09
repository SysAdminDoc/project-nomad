import { SERVICE_NAMES } from '../../constants/service_names.js'

export type VoiceServiceDefinition = {
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

export function getVoiceServiceDefinitions(storagePath: string): VoiceServiceDefinition[] {
  return [
    {
      service_name: SERVICE_NAMES.WHISPER,
      friendly_name: 'Speech to Text',
      powered_by: 'Whisper.cpp',
      display_order: 12,
      description: 'Optional local speech-to-text server with an OpenAI-compatible HTTP API',
      icon: 'IconBrain',
      container_image: 'ghcr.io/ggml-org/whisper.cpp:main',
      source_repo: 'https://github.com/ggml-org/whisper.cpp',
      container_command: 'whisper-server --host 0.0.0.0 --port 8080 -m /models/ggml-base.en.bin',
      container_config: JSON.stringify({
        HostConfig: {
          RestartPolicy: { Name: 'unless-stopped' },
          Binds: [`${storagePath}/whisper:/models`],
          PortBindings: { '8080/tcp': [{ HostPort: '8400' }] },
        },
        ExposedPorts: { '8080/tcp': {} },
      }),
      ui_location: '8400',
      metadata: JSON.stringify({
        category: 'voice',
        protocol: 'http',
        endpoint: '/inference',
        model: 'base.en',
      }),
      installed: false,
      installation_status: 'idle',
      is_dependency_service: false,
      depends_on: null,
    },
    {
      service_name: SERVICE_NAMES.PIPER,
      friendly_name: 'Text to Speech',
      powered_by: 'Piper',
      display_order: 13,
      description: 'Optional local Piper voice server with Wyoming and browser test endpoints',
      icon: 'IconServer',
      container_image: 'rhasspy/wyoming-piper:2.3.1',
      source_repo: 'https://github.com/OHF-Voice/wyoming-piper',
      container_command:
        '--voice en_US-lessac-medium --uri tcp://0.0.0.0:10200 --data-dir /data --download-dir /data --web-server --web-server-host 0.0.0.0 --web-server-port 5000',
      container_config: JSON.stringify({
        HostConfig: {
          RestartPolicy: { Name: 'unless-stopped' },
          Binds: [`${storagePath}/piper:/data`],
          PortBindings: {
            '10200/tcp': [{ HostPort: '8402' }],
            '5000/tcp': [{ HostPort: '8401' }],
          },
        },
        ExposedPorts: { '10200/tcp': {}, '5000/tcp': {} },
      }),
      ui_location: '8401',
      metadata: JSON.stringify({
        category: 'voice',
        protocol: 'wyoming',
        endpoint: 'tcp://host:8402',
        web_endpoint: 'http://host:8401',
        voice: 'en_US-lessac-medium',
      }),
      installed: false,
      installation_status: 'idle',
      is_dependency_service: false,
      depends_on: null,
    },
  ]
}
