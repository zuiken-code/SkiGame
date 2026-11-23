import { BookOpen, Play, Trophy, Volume2, VolumeX } from 'lucide-react'

interface StartOverlayProps {
  ready: boolean
  onPlay: () => void
  onGuide: () => void
  onRanking: () => void
  best: number
  sound: boolean
  onSound: () => void
}

export function StartOverlay({
  ready,
  onPlay,
  onGuide,
  onRanking,
  best,
  sound,
  onSound,
}: StartOverlayProps) {
  return (
    <div className="ski-start">
      <button
        type="button"
        className="ski-start-hit"
        onClick={onPlay}
        disabled={!ready}
        aria-label="タップしてスタート"
      >
        <span className="ski-start-cta">
          {ready && <Play fill="currentColor" size={21} />}
          {ready ? 'タップしてスタート' : 'コースを準備中…'}
        </span>
      </button>
      <nav className="ski-start-nav" aria-label="滑走前のメニュー">
        <button onClick={onGuide}>
          <BookOpen size={16} />
          遊び方
        </button>
        <button onClick={onRanking}>
          <Trophy size={16} />
          ランキング
        </button>
      </nav>
      <button
        className="ski-start-sound"
        onClick={onSound}
        aria-pressed={sound}
        aria-label={sound ? '効果音をオフにする' : '効果音をオンにする'}
      >
        {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
      </button>
      <div className="ski-title">
        <h1>
          雪山<span>おにごっこ</span>
        </h1>
      </div>
      <div className="ski-best">
        <Trophy size={15} /> ベスト <strong>{best.toLocaleString('ja-JP')} m</strong>
      </div>
    </div>
  )
}
