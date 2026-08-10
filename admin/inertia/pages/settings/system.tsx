import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Head } from '@inertiajs/react'
import SettingsLayout from '~/layouts/SettingsLayout'
import { HealthDashboardResponse, SystemInformationResponse } from '../../../types/system'
import { formatBytes } from '~/lib/util'
import { getAllDiskDisplayItems } from '~/hooks/useDiskDisplayData'
import CircularGauge from '~/components/systeminfo/CircularGauge'
import HorizontalBarChart from '~/components/HorizontalBarChart'
import InfoCard from '~/components/systeminfo/InfoCard'
import Alert from '~/components/Alert'
import StyledModal from '~/components/StyledModal'
import { useSystemInfo } from '~/hooks/useSystemInfo'
import { useNotifications } from '~/context/NotificationContext'
import { useModals } from '~/context/ModalContext'
import api from '~/lib/api'
import StatusCard from '~/components/systeminfo/StatusCard'
import {
  IconCpu,
  IconDatabase,
  IconServer,
  IconDeviceDesktop,
  IconComponents,
} from '@tabler/icons-react'

export default function SettingsPage(props: {
  system: {
    info: SystemInformationResponse | undefined
    health: HealthDashboardResponse | undefined
  }
}) {
  const { data: info } = useSystemInfo({
    initialData: props.system.info,
  })
  const { data: health } = useQuery<HealthDashboardResponse | undefined>({
    queryKey: ['system-health-dashboard'],
    queryFn: () => api.getHealthDashboard(),
    initialData: props.system.health,
    refetchInterval: 30000,
  })
  const { addNotification } = useNotifications()
  const { openModal, closeAllModals } = useModals()

  const [gpuBannerDismissed, setGpuBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem('nomad:gpu-banner-dismissed') === 'true'
    } catch {
      return false
    }
  })
  const [reinstalling, setReinstalling] = useState(false)

  const handleDismissGpuBanner = () => {
    setGpuBannerDismissed(true)
    try {
      localStorage.setItem('nomad:gpu-banner-dismissed', 'true')
    } catch {}
  }

  const handleForceReinstallOllama = () => {
    openModal(
      <StyledModal
        title="Reinstall AI Assistant?"
        onConfirm={async () => {
          closeAllModals()
          setReinstalling(true)
          try {
            const response = await api.forceReinstallService('nomad_ollama')
            if (!response || !response.success) {
              throw new Error(response?.message || 'Force reinstall failed')
            }
            addNotification({
              message:
                'AI Assistant is being reinstalled with GPU support. This page will reload shortly.',
              type: 'success',
            })
            try {
              localStorage.removeItem('nomad:gpu-banner-dismissed')
            } catch {}
            setTimeout(() => window.location.reload(), 5000)
          } catch (error) {
            addNotification({
              message: `Failed to reinstall: ${error instanceof Error ? error.message : 'Unknown error'}`,
              type: 'error',
            })
            setReinstalling(false)
          }
        }}
        onCancel={closeAllModals}
        open={true}
        confirmText="Reinstall"
        cancelText="Cancel"
      >
        <p className="text-text-primary">
          This will recreate the AI Assistant container with GPU support enabled. Your downloaded
          models will be preserved. The service will be briefly unavailable during reinstall.
        </p>
      </StyledModal>,
      'gpu-health-force-reinstall-modal'
    )
  }

  // Use (total - available) to reflect actual memory pressure.
  // mem.used includes reclaimable buff/cache on Linux, which inflates the number.
  const memoryUsed =
    info?.mem.total && info?.mem.available != null
      ? info.mem.total - info.mem.available
      : info?.mem.used || 0
  const memoryUsagePercent = info?.mem.total ? ((memoryUsed / info.mem.total) * 100).toFixed(1) : 0

  const swapUsagePercent = info?.mem.swaptotal
    ? ((info.mem.swapused / info.mem.swaptotal) * 100).toFixed(1)
    : 0

  const uptimeSeconds = info?.uptime.uptime || 0
  const uptimeDays = Math.floor(uptimeSeconds / 86400)
  const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600)
  const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60)
  const uptimeDisplay =
    uptimeDays > 0
      ? `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`
      : uptimeHours > 0
        ? `${uptimeHours}h ${uptimeMinutes}m`
        : `${uptimeMinutes}m`

  // Build storage display items - fall back to fsSize when disk array is empty
  const storageItems = getAllDiskDisplayItems(info?.disk, info?.fsSize)
  const toolStorageTotal =
    health?.diskUsageByTool.reduce((total, item) => total + item.sizeBytes, 0) || 0
  const containerMemoryTotal =
    health?.containerMemory.reduce((total, item) => total + item.memoryBytes, 0) || 0
  const formatHealthTimestamp = (timestamp: string | null | undefined) =>
    timestamp ? new Date(timestamp).toLocaleString() : 'No ZIM content installed'
  const formatHealthUptime = (seconds: number | undefined) => {
    if (!seconds) return 'Checking...'
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return days > 0
      ? `${days}d ${hours}h ${minutes}m`
      : hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m`
  }

  return (
    <SettingsLayout>
      <Head title="System Information" />
      <div className="xl:pl-72 w-full">
        <main className="px-6 lg:px-12 py-6 lg:py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-desert-green mb-2">System Information</h1>
            <p className="text-desert-stone-dark">
              Real-time monitoring and diagnostics • Last updated: {new Date().toLocaleString()} •
              Refreshing data every 30 seconds
            </p>
          </div>
          {Number(memoryUsagePercent) > 90 && (
            <div className="mb-6">
              <Alert
                type="error"
                title="Very High Memory Usage Detected"
                message="System memory usage exceeds 90%. Performance degradation may occur."
                variant="bordered"
              />
            </div>
          )}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-desert-green" />
              Health Dashboard
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
              <StatusCard
                title="Last ZIM update"
                value={formatHealthTimestamp(health?.lastZimUpdateAt)}
              />
              <StatusCard title="Container RAM" value={formatBytes(containerMemoryTotal)} />
              <StatusCard title="Uptime" value={formatHealthUptime(health?.uptimeSeconds)} />
              <StatusCard
                title="Dashboard collected"
                value={
                  health?.collectedAt
                    ? new Date(health.collectedAt).toLocaleTimeString()
                    : 'Checking...'
                }
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm">
                <h3 className="text-lg font-semibold text-desert-green mb-4">Disk usage by tool</h3>
                {health?.diskUsageByTool.length ? (
                  <div className="space-y-4">
                    {health.diskUsageByTool.map((item) => {
                      const share =
                        toolStorageTotal > 0 ? (item.sizeBytes / toolStorageTotal) * 100 : 0
                      return (
                        <div key={item.id}>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium text-desert-stone-dark">{item.label}</span>
                            <span className="font-mono text-desert-green-dark">
                              {formatBytes(item.sizeBytes)}
                            </span>
                          </div>
                          <div className="mt-1 h-3 overflow-hidden rounded-full bg-desert-stone-lighter">
                            <div
                              className="h-full rounded-full bg-desert-green transition-all duration-500"
                              style={{ width: `${Math.max(share, 1)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-desert-stone-dark">
                    No tool-specific storage has been recorded yet.
                  </p>
                )}
              </div>

              <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm">
                <h3 className="text-lg font-semibold text-desert-green mb-4">RAM per container</h3>
                {health?.containerMemory.length ? (
                  <div className="space-y-3">
                    {health.containerMemory.map((container) => (
                      <div
                        key={container.name}
                        className="flex items-center justify-between gap-4 border-b border-desert-stone-lighter pb-3 last:border-b-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-desert-stone-dark">
                            {container.label}
                          </div>
                          <div className="text-xs capitalize text-desert-stone">
                            {container.status}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-sm text-desert-green-dark">
                            {formatBytes(container.memoryBytes)}
                          </div>
                          <div className="text-xs text-desert-stone">
                            {container.memoryPercent === null
                              ? 'Limit unavailable'
                              : `${container.memoryPercent}% of limit`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-desert-stone-dark">
                    Container memory data is not available.
                  </p>
                )}
              </div>
            </div>
          </section>
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-desert-green" />
              Resource Usage
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm hover:shadow-lg transition-shadow">
                <CircularGauge
                  value={info?.currentLoad.currentLoad || 0}
                  label="CPU Usage"
                  size="lg"
                  variant="cpu"
                  subtext={`${info?.cpu.cores || 0} cores`}
                  icon={<IconCpu className="w-8 h-8" />}
                />
              </div>
              <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm hover:shadow-lg transition-shadow">
                <CircularGauge
                  value={Number(memoryUsagePercent)}
                  label="Memory Usage"
                  size="lg"
                  variant="memory"
                  subtext={`${formatBytes(memoryUsed)} / ${formatBytes(info?.mem.total || 0)}`}
                  icon={<IconDatabase className="w-8 h-8" />}
                />
              </div>
              <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm hover:shadow-lg transition-shadow">
                <CircularGauge
                  value={Number(swapUsagePercent)}
                  label="Swap Usage"
                  size="lg"
                  variant="disk"
                  subtext={`${formatBytes(info?.mem.swapused || 0)} / ${formatBytes(info?.mem.swaptotal || 0)}`}
                  icon={<IconServer className="w-8 h-8" />}
                />
              </div>
            </div>
          </section>
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-desert-green" />
              System Details
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <InfoCard
                title="Operating System"
                icon={<IconDeviceDesktop className="w-6 h-6" />}
                variant="elevated"
                data={[
                  { label: 'Distribution', value: info?.os.distro },
                  { label: 'Kernel Version', value: info?.os.kernel },
                  { label: 'Architecture', value: info?.os.arch },
                  { label: 'Hostname', value: info?.os.hostname },
                  { label: 'Platform', value: info?.os.platform },
                ]}
              />
              <InfoCard
                title="Processor"
                icon={<IconCpu className="w-6 h-6" />}
                variant="elevated"
                data={[
                  { label: 'Manufacturer', value: info?.cpu.manufacturer },
                  { label: 'Brand', value: info?.cpu.brand },
                  { label: 'Cores', value: info?.cpu.cores },
                  { label: 'Physical Cores', value: info?.cpu.physicalCores },
                  {
                    label: 'Virtualization',
                    value: info?.cpu.virtualization ? 'Enabled' : 'Disabled',
                  },
                ]}
              />
              {info?.gpuHealth?.status === 'passthrough_failed' && !gpuBannerDismissed && (
                <div className="lg:col-span-2">
                  <Alert
                    type="warning"
                    variant="bordered"
                    title="GPU Not Accessible to AI Assistant"
                    message="Your system has an NVIDIA GPU, but the AI Assistant can't access it. AI is running on CPU only, which is significantly slower."
                    dismissible={true}
                    onDismiss={handleDismissGpuBanner}
                    buttonProps={{
                      children: 'Fix: Reinstall AI Assistant',
                      icon: 'IconRefresh',
                      variant: 'action',
                      size: 'sm',
                      onClick: handleForceReinstallOllama,
                      loading: reinstalling,
                      disabled: reinstalling,
                    }}
                  />
                </div>
              )}
              {info?.graphics?.controllers && info.graphics.controllers.length > 0 && (
                <InfoCard
                  title="Graphics"
                  icon={<IconComponents className="w-6 h-6" />}
                  variant="elevated"
                  data={info.graphics.controllers
                    .map((gpu, i) => {
                      const prefix = info.graphics.controllers.length > 1 ? `GPU ${i + 1} ` : ''
                      return [
                        { label: `${prefix}Model`, value: gpu.model },
                        { label: `${prefix}Vendor`, value: gpu.vendor },
                        { label: `${prefix}VRAM`, value: gpu.vram ? `${gpu.vram} MB` : 'N/A' },
                      ]
                    })
                    .flat()}
                />
              )}
            </div>
          </section>
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-desert-green" />
              Memory Allocation
            </h2>
            <div className="bg-desert-white rounded-lg p-8 border border-desert-stone-light shadow-sm hover:shadow-lg transition-shadow">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-desert-green mb-1">
                    {formatBytes(info?.mem.total || 0)}
                  </div>
                  <div className="text-sm text-desert-stone-dark uppercase tracking-wide">
                    Total RAM
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-desert-green mb-1">
                    {formatBytes(memoryUsed)}
                  </div>
                  <div className="text-sm text-desert-stone-dark uppercase tracking-wide">
                    Used RAM
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-desert-green mb-1">
                    {formatBytes(info?.mem.available || 0)}
                  </div>
                  <div className="text-sm text-desert-stone-dark uppercase tracking-wide">
                    Available RAM
                  </div>
                </div>
              </div>
              <div className="relative h-12 bg-desert-stone-lighter rounded-lg overflow-hidden border border-desert-stone-light">
                <div
                  className="absolute left-0 top-0 h-full bg-desert-orange transition-all duration-1000"
                  style={{ width: `${memoryUsagePercent}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-white drop-shadow-md z-10">
                    {memoryUsagePercent}% Utilized
                  </span>
                </div>
              </div>
            </div>
          </section>
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-desert-green" />
              Storage Devices
            </h2>

            <div className="bg-desert-white rounded-lg p-8 border border-desert-stone-light shadow-sm hover:shadow-lg transition-shadow">
              {storageItems.length > 0 ? (
                <HorizontalBarChart
                  items={storageItems}
                  progressiveBarColor={true}
                  statuses={[
                    {
                      label: 'Normal',
                      min_threshold: 0,
                      color_class: 'bg-desert-olive',
                    },
                    {
                      label: 'Warning - Usage High',
                      min_threshold: 75,
                      color_class: 'bg-desert-orange',
                    },
                    {
                      label: 'Critical - Disk Almost Full',
                      min_threshold: 90,
                      color_class: 'bg-desert-red',
                    },
                  ]}
                />
              ) : (
                <div className="text-center text-desert-stone-dark py-8">
                  No storage devices detected
                </div>
              )}
            </div>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-desert-green" />
              System Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatusCard title="System Uptime" value={uptimeDisplay} />
              <StatusCard title="CPU Cores" value={info?.cpu.cores || 0} />
              <StatusCard title="Storage Devices" value={storageItems.length} />
            </div>
          </section>
        </main>
      </div>
    </SettingsLayout>
  )
}
