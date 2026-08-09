export type DeveloperCache = {
  id: 'npm' | 'pypi' | 'docker'
  name: string
  description: string
  service_name: string
  container_image: string
  endpoint: string
  setup_command: string
  storage_path: string
  installed: boolean
  installation_status: 'idle' | 'installing' | 'error'
  status: string
  size_bytes: number
}
