import { FlagTriangleRight, Trophy, UserRound, Volume2, VolumeX } from 'lucide-react'

export type Page = 'lobby' | 'ranking'

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? 'brand-small' : ''}`}>
      <svg className="brand-mark" viewBox="0 0 45 32" fill="currentColor" aria-hidden="true">
        <path d="M0 28 17 2l8 12 5-7 15 21H30L17 11 6 28z" />
        <path d="m15 28 5-8 6 8z" />
      </svg>
      <span>
        RIDGE<span className="brand-accent">ARCADE</span>
      </span>
    </span>
  )
}

interface Props {
  page: Page
  onPage: (page: Page) => void
  name: string
  sound: boolean
  toggleSound: () => void
  onProfile: () => void
}

export function Header({ page, onPage, name, sound, toggleSound, onProfile }: Props) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <button
          className="brand-button"
          aria-label="Ridge Arcade ホーム"
          onClick={() => onPage('lobby')}
        >
          <Brand />
        </button>
        <nav aria-label="メインメニュー">
          <button
            aria-current={page === 'lobby' ? 'page' : undefined}
            onClick={() => onPage('lobby')}
          >
            <FlagTriangleRight size={16} />
            ベースキャンプ
          </button>
          <button
            aria-current={page === 'ranking' ? 'page' : undefined}
            onClick={() => onPage('ranking')}
          >
            <Trophy size={16} />
            ランキング
          </button>
        </nav>
        <div className="header-tools">
          <button
            className="sound-button"
            aria-label={sound ? '効果音をオフにする' : '効果音をオンにする'}
            aria-pressed={sound}
            onClick={toggleSound}
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button className="player-button" onClick={onProfile} aria-label="プレーヤー名を設定">
            <UserRound size={15} />
            <span>{name || 'ゲスト'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
