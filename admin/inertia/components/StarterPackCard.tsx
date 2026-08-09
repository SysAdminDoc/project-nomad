import classNames from 'classnames'
import { IconCircleCheck, IconDownload } from '@tabler/icons-react'
import type { StarterPackWithStatus } from '../../types/collections'
import DynamicIcon, { DynamicIconName } from './DynamicIcon'
import { formatBytes } from '~/lib/util'

type StarterPackCardProps = {
  pack: StarterPackWithStatus
  selected?: boolean
  disabled?: boolean
  onSelect: (pack: StarterPackWithStatus) => void
}

const StarterPackCard: React.FC<StarterPackCardProps> = ({
  pack,
  selected,
  disabled,
  onSelect,
}) => {
  const unavailable = !pack.available || disabled

  return (
    <button
      type="button"
      disabled={unavailable}
      onClick={() => onSelect(pack)}
      className={classNames(
        'text-left p-5 rounded-lg border-2 transition-all bg-surface-primary',
        selected
          ? 'border-desert-green bg-desert-green text-white shadow-md'
          : 'border-desert-stone-light hover:border-desert-green hover:shadow-sm',
        unavailable && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <DynamicIcon
            icon={pack.icon as DynamicIconName}
            className={classNames('w-6 h-6', selected ? 'text-white' : 'text-text-primary')}
          />
          <h4 className="text-lg font-semibold">{pack.name}</h4>
        </div>
        {selected ? (
          <IconCircleCheck className="w-5 h-5 text-lime-300" />
        ) : (
          <IconDownload className="w-5 h-5" />
        )}
      </div>
      <p
        className={classNames('mt-3 text-sm', selected ? 'text-green-100' : 'text-text-secondary')}
      >
        {pack.description}
      </p>
      <div className={classNames('mt-4 text-xs', selected ? 'text-green-100' : 'text-text-muted')}>
        {pack.available
          ? `${pack.resource_count} resources · ${formatBytes(pack.size_mb * 1024 * 1024, 1)}`
          : 'Unavailable with the current content catalog'}
        {pack.installed_count > 0 &&
          pack.available &&
          ` · ${pack.installed_count} already installed`}
      </div>
    </button>
  )
}

export default StarterPackCard
