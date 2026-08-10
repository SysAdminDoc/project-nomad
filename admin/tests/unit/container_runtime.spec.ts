import { test } from '@japa/runner'
import { getContainerSocket, normalizeContainerRuntime } from '../../app/utils/container_runtime.js'

test.group('container runtime utilities', () => {
  test('defaults to Docker and accepts Podman explicitly', ({ assert }) => {
    assert.equal(normalizeContainerRuntime(undefined), 'docker')
    assert.equal(normalizeContainerRuntime('podman'), 'podman')
    assert.equal(normalizeContainerRuntime('DOCKER'), 'docker')
    assert.equal(normalizeContainerRuntime('unexpected'), 'docker')
  })

  test('uses the rootless Podman socket when no socket is configured', ({ assert }) => {
    const socket = getContainerSocket('podman')
    if (process.platform === 'win32') {
      assert.equal(socket, '//./pipe/docker_engine')
    } else {
      assert.match(socket, /podman[\\/]podman\.sock$/)
    }
  })
})
