import { Head, Link } from '@inertiajs/react'
import DynamicIcon, { DynamicIconName } from '~/components/DynamicIcon'
import ThemeToggle from '~/components/ThemeToggle'

type KioskTool = {
  id: string
  label: string
  description: string
  href: string
  target: '_self' | '_blank'
  icon: string
}

export default function Kiosk({ kiosk }: { kiosk: { tools: KioskTool[] } }) {
  return (
    <div className="min-h-screen flex flex-col bg-desert">
      <Head title="Guest Kiosk" />
      <header className="flex flex-col items-center px-4 py-8 text-center">
        <img src="/project_nomad_logo.webp" alt="Project Nomad Logo" className="h-28 w-28" />
        <h1 className="mt-4 text-4xl font-bold text-desert-green">Guest Kiosk</h1>
        <p className="mt-2 max-w-2xl text-text-secondary">
          Choose a tool to begin. Administrative controls are disabled for this deployment.
        </p>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10">
        {kiosk.tools.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-lg border border-border-subtle bg-surface-primary p-8 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-text-primary">
              No kiosk tools are available
            </h2>
            <p className="mt-2 text-text-secondary">
              Ask the deployment administrator to install one of the configured classroom tools.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kiosk.tools.map((tool) => {
              const tile = (
                <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border-2 border-desert-green bg-desert-green px-5 py-6 text-center text-white shadow-sm transition-colors hover:bg-transparent hover:text-text-primary">
                  <DynamicIcon icon={tool.icon as DynamicIconName} className="!mb-3 !h-12 !w-12" />
                  <h2 className="text-2xl font-bold">{tool.label}</h2>
                  <p className="mt-2 text-sm opacity-85">{tool.description}</p>
                </div>
              )

              return tool.target === '_blank' ? (
                <a key={tool.id} href={tool.href} target="_blank" rel="noopener noreferrer">
                  {tile}
                </a>
              ) : (
                <Link key={tool.id} href={tool.href}>
                  {tile}
                </Link>
              )
            })}
          </div>
        )}
      </main>

      <footer className="flex items-center justify-center gap-3 border-t border-border-subtle py-4 text-sm text-text-secondary">
        <span>Project N.O.M.A.D.</span>
        <span aria-hidden="true">|</span>
        <span>Guest access</span>
        <ThemeToggle />
      </footer>
    </div>
  )
}
