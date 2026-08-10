import { Head } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import SettingsLayout from '~/layouts/SettingsLayout'
import StyledButton from '~/components/StyledButton'
import Alert from '~/components/Alert'
import Input from '~/components/inputs/Input'
import { useNotifications } from '~/context/NotificationContext'
import api from '~/lib/api'
import { formatBytes } from '~/lib/util'
import { buildClusterResourceKey } from '~/lib/cluster'
import type { ClusterConfig, ClusterStatus } from '../../../types/cluster'

export default function ClusterPage() {
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()
  const [remoteUrl, setRemoteUrl] = useState('')
  const [nodeName, setNodeName] = useState('')
  const [token, setToken] = useState('')
  const [selectedResources, setSelectedResources] = useState<string[]>([])

  const statusQuery = useQuery<ClusterStatus | undefined>({
    queryKey: ['cluster-status'],
    queryFn: () => api.getClusterStatus(),
    refetchInterval: 30000,
  })

  useEffect(() => {
    if (!statusQuery.data) return
    setRemoteUrl((current) => current || statusQuery.data?.remote.url || '')
    setNodeName((current) => current || statusQuery.data?.local.node_name || '')
  }, [statusQuery.data])

  const tokenMutation = useMutation({
    mutationFn: () => api.generateClusterToken(),
    onSuccess: (result) => {
      if (result?.token) {
        setToken(result.token)
        addNotification({
          type: 'success',
          message: 'New shared token generated. Use the same token on both boxes.',
        })
      }
    },
  })

  const configMutation = useMutation({
    mutationFn: (config: ClusterConfig) => api.configureCluster(config),
    onSuccess: (result) => {
      if (result?.success) {
        addNotification({ type: 'success', message: result.message })
        setToken('')
        queryClient.invalidateQueries({ queryKey: ['cluster-status'] })
      } else {
        addNotification({
          type: 'error',
          message: result?.message || 'Cluster configuration failed',
        })
      }
    },
  })

  const syncMutation = useMutation({
    mutationFn: (resourceKeys: string[]) => api.syncClusterResources(resourceKeys),
    onSuccess: (result) => {
      if (result?.success) {
        addNotification({ type: 'success', message: result.message, duration: 8000 })
      } else {
        addNotification({ type: 'error', message: result?.message || 'Cluster sync failed' })
      }
      queryClient.invalidateQueries({ queryKey: ['cluster-status'] })
    },
  })

  const remoteResources = statusQuery.data?.remote.resources || []
  const remoteKeys = useMemo(
    () =>
      remoteResources.map((resource) =>
        buildClusterResourceKey(resource.resource_id, resource.resource_type)
      ),
    [remoteResources]
  )
  const allSelected =
    remoteKeys.length > 0 && remoteKeys.every((key) => selectedResources.includes(key))

  const saveConfig = () => {
    configMutation.mutate({
      remote_url: remoteUrl,
      node_name: nodeName,
      token,
    })
  }

  const toggleResource = (key: string) => {
    setSelectedResources((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    )
  }

  const toggleAll = () => {
    setSelectedResources(allSelected ? [] : remoteKeys)
  }

  return (
    <SettingsLayout>
      <Head title="Cluster Sync" />
      <div className="xl:pl-72 w-full">
        <main className="px-12 py-6">
          <div className="mb-8">
            <h1 className="text-4xl font-semibold">Cluster Sync</h1>
            <p className="text-text-muted mt-1 max-w-4xl">
              Pair two N.O.M.A.D. boxes over a trusted LAN and mirror selected ZIM files and offline
              map regions without exposing arbitrary filesystem paths.
            </p>
          </div>

          <Alert
            type="warning"
            variant="bordered"
            title="Use this only on a trusted network"
            message="The shared token authorizes access to the selected content manifest and streamed files. Use HTTPS or an isolated LAN when the network is not fully trusted."
          />

          <section className="bg-surface-primary rounded-lg border border-border-subtle p-6 mt-8">
            <h2 className="text-xl font-semibold text-text-primary">Pairing</h2>
            <p className="text-sm text-text-secondary mt-2 max-w-3xl">
              Generate a token on one box, then enter that same token and the peer URL on both
              boxes. Leave the token field blank to keep the currently saved token.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <Input
                name="cluster-node-name"
                label="This box's name"
                value={nodeName}
                onChange={(event) => setNodeName(event.target.value)}
                placeholder="nomad-primary"
              />
              <Input
                name="cluster-remote-url"
                label="Paired box URL"
                value={remoteUrl}
                onChange={(event) => setRemoteUrl(event.target.value)}
                placeholder="http://nomad-peer.local:8080"
                helpText="Include the Command Center port, without query parameters."
              />
            </div>
            <div className="mt-6 max-w-2xl">
              <Input
                name="cluster-token"
                label="Shared pairing token"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder={
                  statusQuery.data?.local.sharing_enabled
                    ? 'Saved token (unchanged)'
                    : 'Generate or paste a token'
                }
                helpText="Tokens are stored locally and never returned by the status endpoint."
              />
            </div>
            <div className="flex flex-wrap gap-3 mt-6">
              <StyledButton
                variant="secondary"
                icon="IconCopy"
                onClick={() => tokenMutation.mutate()}
                loading={tokenMutation.isPending}
              >
                Generate shared token
              </StyledButton>
              <StyledButton
                icon="IconUpload"
                onClick={saveConfig}
                loading={configMutation.isPending}
              >
                Save pairing
              </StyledButton>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            <div className="bg-surface-primary rounded-lg border border-border-subtle p-6">
              <p className="text-sm text-text-muted">This box</p>
              <p className="text-xl font-semibold text-text-primary mt-1">
                {statusQuery.data?.local.node_name || 'Loading…'}
              </p>
              <p className="text-sm text-text-secondary mt-2">
                {statusQuery.data?.local.resource_count || 0} shareable resource(s)
              </p>
              <p className="text-sm mt-3 text-desert-green">
                {statusQuery.data?.local.sharing_enabled
                  ? 'Sharing enabled'
                  : 'Sharing not configured'}
              </p>
            </div>
            <div className="bg-surface-primary rounded-lg border border-border-subtle p-6 lg:col-span-2">
              <p className="text-sm text-text-muted">Paired box</p>
              <p className="text-xl font-semibold text-text-primary mt-1">
                {statusQuery.data?.remote.node_name ||
                  statusQuery.data?.remote.url ||
                  'Not configured'}
              </p>
              <p className="text-sm text-text-secondary mt-2">
                {statusQuery.data?.remote.resources.length || 0} resource(s) available to mirror
              </p>
              {statusQuery.data?.remote.error && (
                <p className="text-sm text-desert-orange mt-3">{statusQuery.data.remote.error}</p>
              )}
              {!statusQuery.data?.remote.error && statusQuery.data?.remote.configured && (
                <p className="text-sm text-desert-green mt-3">
                  {statusQuery.data.remote.reachable ? 'Connected' : 'Checking connection…'}
                </p>
              )}
            </div>
          </section>

          <section className="bg-surface-primary rounded-lg border border-border-subtle p-6 mt-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">Remote content</h2>
                <p className="text-sm text-text-secondary mt-1">
                  Select resources to copy to this box. Existing files are replaced atomically.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StyledButton
                  size="sm"
                  variant="ghost"
                  onClick={toggleAll}
                  disabled={!remoteKeys.length}
                >
                  {allSelected ? 'Clear all' : 'Select all'}
                </StyledButton>
                <StyledButton
                  size="sm"
                  icon="IconRefresh"
                  onClick={() => syncMutation.mutate(selectedResources)}
                  loading={syncMutation.isPending}
                  disabled={!selectedResources.length || syncMutation.isPending}
                >
                  Sync selected ({selectedResources.length})
                </StyledButton>
              </div>
            </div>

            {remoteResources.length === 0 ? (
              <p className="text-sm text-text-muted mt-6">
                No remote resources are available. Save pairing settings and make sure the peer has
                installed ZIM files or maps.
              </p>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-text-muted border-b border-border-subtle">
                    <tr>
                      <th className="py-3 pr-4">Select</th>
                      <th className="py-3 pr-4">Resource</th>
                      <th className="py-3 pr-4">Type</th>
                      <th className="py-3 pr-4">Version</th>
                      <th className="py-3">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remoteResources.map((resource) => {
                      const key = buildClusterResourceKey(
                        resource.resource_id,
                        resource.resource_type
                      )
                      return (
                        <tr key={key} className="border-b border-border-subtle last:border-b-0">
                          <td className="py-3 pr-4">
                            <input
                              type="checkbox"
                              checked={selectedResources.includes(key)}
                              onChange={() => toggleResource(key)}
                              className="h-4 w-4 accent-desert-green"
                              aria-label={`Select ${resource.filename}`}
                            />
                          </td>
                          <td className="py-3 pr-4">
                            <p className="font-medium text-text-primary">{resource.filename}</p>
                            <p className="text-xs text-text-muted break-all">
                              {resource.resource_id}
                            </p>
                          </td>
                          <td className="py-3 pr-4 text-text-secondary">
                            {resource.resource_type}
                          </td>
                          <td className="py-3 pr-4 text-text-secondary">{resource.version}</td>
                          <td className="py-3 text-text-secondary">
                            {formatBytes(resource.size_bytes, 1)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </SettingsLayout>
  )
}
