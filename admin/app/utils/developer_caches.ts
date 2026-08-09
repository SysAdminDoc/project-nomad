import type { DeveloperCache } from '../../types/caches.js'
import { SERVICE_NAMES } from '../../constants/service_names.js'

export const CACHE_DEFINITIONS: Array<
  Pick<
    DeveloperCache,
    'id' | 'name' | 'description' | 'service_name' | 'endpoint' | 'setup_command' | 'storage_path'
  >
> = [
  {
    id: 'npm',
    name: 'npm proxy cache',
    description: 'On-demand Verdaccio cache for npm, Yarn, and pnpm packages.',
    service_name: SERVICE_NAMES.NPM_CACHE,
    endpoint: 'http://localhost:4873',
    setup_command: 'npm config set registry http://localhost:4873',
    storage_path: 'caches/npm',
  },
  {
    id: 'pypi',
    name: 'PyPI proxy cache',
    description: 'On-demand devpi mirror for pip, uv, and other Python package installers.',
    service_name: SERVICE_NAMES.PYPI_CACHE,
    endpoint: 'http://localhost:3141/root/pypi/+simple/',
    setup_command:
      'python -m pip config set global.index-url http://localhost:3141/root/pypi/+simple/',
    storage_path: 'caches/pypi',
  },
  {
    id: 'docker',
    name: 'Docker Hub pull-through cache',
    description: 'Persistent Distribution Registry cache for Docker Hub images.',
    service_name: SERVICE_NAMES.DOCKER_CACHE,
    endpoint: 'http://localhost:5000',
    setup_command: 'docker pull localhost:5000/library/alpine:latest',
    storage_path: 'caches/docker',
  },
]
