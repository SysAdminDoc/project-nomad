export type ContainerRuntime = 'docker' | 'podman'

export function normalizeContainerRuntime(value: string | undefined | null): ContainerRuntime {
  const runtime = value?.trim().toLowerCase()
  if (runtime === 'podman') return 'podman'
  return 'docker'
}

export function getContainerRuntime(): ContainerRuntime {
  return normalizeContainerRuntime(process.env.NOMAD_CONTAINER_RUNTIME)
}

/**
 * Returns the socket exposed to the admin process. Rootless Podman exposes a
 * Docker-compatible API at /run/user/<uid>/podman/podman.sock; compose mounts
 * that host path to /var/run/docker.sock inside the admin container.
 */
export function getContainerSocket(runtime = getContainerRuntime()): string {
  const configured = process.env.NOMAD_DOCKER_SOCKET?.trim()
  if (configured) return configured

  if (runtime === 'podman' && process.platform !== 'win32') {
    const uid = typeof process.getuid === 'function' ? process.getuid() : 1000
    return `/run/user/${uid}/podman/podman.sock`
  }

  return process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock'
}
