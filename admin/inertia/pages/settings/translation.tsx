import { Head } from '@inertiajs/react'
import SettingsLayout from '~/layouts/SettingsLayout'
import TranslationPanel from '~/components/TranslationPanel'

export default function TranslationPage() {
  return (
    <SettingsLayout>
      <Head title="Offline Translation" />
      <div className="xl:pl-72 w-full">
        <main className="px-12 py-6">
          <div className="mb-8">
            <h1 className="text-4xl font-semibold mb-2">Offline Translation</h1>
            <p className="text-text-muted max-w-3xl">
              Translate copied text from offline maps and Kiwix articles with local Argos Translate
              models. Text stays on this N.O.M.A.D. device.
            </p>
          </div>
          <TranslationPanel context="general" />
        </main>
      </div>
    </SettingsLayout>
  )
}
