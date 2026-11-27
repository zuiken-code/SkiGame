import { ChevronRight, MountainSnow, Trophy, Zap } from 'lucide-react'
import { useId } from 'react'
import { editionNames, type GameEdition } from '../../game/edition'
import { Modal } from '../Dialogs/Dialogs'
import './mode-picker.css'

const modes = [
  {
    edition: 'classic',
    Icon: MountainSnow,
    description: '岩や木を避け、追手を振り切る。',
  },
  {
    edition: 'new',
    Icon: Zap,
    description: '加速と大ジャンプ。空中では鳩をかわす。',
  },
] as const

export function ModePicker({
  onSelect,
  onClose,
  best,
}: {
  onSelect: (edition: GameEdition) => void
  onClose: () => void
  best: Record<GameEdition, number>
}) {
  const id = useId()

  return (
    <Modal title="モードを選ぶ" onClose={onClose}>
      <div className="mode-picker">
        {modes.map(({ edition, Icon, description }) => {
          const nameId = `${id}-${edition}-name`
          const descriptionId = `${id}-${edition}-description`
          const recordId = `${id}-${edition}-record`
          const record = best[edition]

          return (
            <button
              className={`mode-picker-option mode-picker-${edition}`}
              type="button"
              key={edition}
              aria-labelledby={nameId}
              aria-describedby={record > 0 ? `${descriptionId} ${recordId}` : descriptionId}
              onClick={() => onSelect(edition)}
            >
              <span className="mode-picker-icon" aria-hidden="true">
                <Icon size={23} />
              </span>
              <span className="mode-picker-copy">
                <strong className="mode-picker-name" id={nameId}>
                  {editionNames[edition]}
                </strong>
                <span className="mode-picker-description" id={descriptionId}>
                  {description}
                </span>
                {record > 0 && (
                  <span className="mode-picker-best" id={recordId}>
                    <Trophy size={13} aria-hidden="true" /> ベスト {record.toLocaleString('ja-JP')} m
                  </span>
                )}
              </span>
              <ChevronRight className="mode-picker-chevron" size={19} aria-hidden="true" />
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
