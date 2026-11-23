import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  Crosshair,
  Gamepad2,
  MapPin,
  MousePointer2,
  Play,
  RotateCcw,
  Share2,
  Trophy,
  X,
} from 'lucide-react'
import { validName } from '../../services/profile'
import type { RunEndReason } from '../../game/simulation'

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose?: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      className="dialog"
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault()
        onClose?.()
      }}
    >
      <div className="dialog-top">
        <h2>{title}</h2>
        {onClose && (
          <button className="icon-button" aria-label="閉じる" onClick={onClose}>
            <X size={18} />
          </button>
        )}
      </div>
      {children}
    </dialog>
  )
}

export function Guide({ close, start }: { close: () => void; start: () => void }) {
  return (
    <Modal title="遊び方" onClose={close}>
      <p className="modal-lead">スキーは自動で前へ。指一本で進路と速度を調整しよう。</p>
      <div className="guide-rows">
        <div>
          <MousePointer2 />
          <p>
            <strong>好きな場所をタッチ</strong>
            <span>押した場所にジョイスティックが現れます。</span>
          </p>
        </div>
        <div>
          <RotateCcw />
          <p>
            <strong>追手が両手を伸ばしたら急ターン</strong>
            <span>
              手に触れると捕まります。追手はつかみ損ねると転び、急ターンでかわすとすぐに転びます。
            </span>
          </p>
        </div>
        <div>
          <ArrowLeftRight />
          <p>
            <strong>左右にドラッグしてターン</strong>
            <span>岩や木に当たると滑走終了。ぎりぎりでかわすと追手をぶつけて振り切れます。</span>
          </p>
        </div>
        <div>
          <ArrowDown />
          <p>
            <strong>手前に引いて減速</strong>
            <span>指を離すと通常速度に戻ります。</span>
          </p>
        </div>
      </div>
      <p className="keyboard-note">
        <Gamepad2 size={16} />
        キーボードでは ← → でターン、↓ で減速。
      </p>
      <button className="btn btn-primary full" onClick={start}>
        <Play size={16} fill="currentColor" />
        滑走スタート
      </button>
    </Modal>
  )
}

export interface Result {
  distance: number
  eliminated: number
  reason: RunEndReason
  newBest: boolean
}

interface ResultProps {
  result: Result
  currentName: string
  submit: (name: string) => Promise<number>
  replay: () => void
  home: () => void
}

export function ResultDialog({ result, currentName, submit, replay, home }: ResultProps) {
  const [name, setName] = useState(currentName)
  const [rank, setRank] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'manual'>('idle')
  const shareText = `⛷️ 雪山おにごっこで ${result.distance.toLocaleString('ja-JP')} m 滑った！`
  const gameUrl = new URL(window.location.pathname, window.location.origin).href
  const shareMessage = `${shareText}\n${gameUrl}`

  async function shareResult() {
    if (navigator.share) {
      try {
        await navigator.share({ title: '雪山おにごっこ', text: shareText, url: gameUrl })
        return
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(shareMessage)
      setShareStatus('copied')
    } catch {
      setShareStatus('manual')
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!validName(name)) {
      setError('プレーヤー名は1〜16文字で入力してください。')
      return
    }
    setBusy(true)
    setError('')
    try {
      setRank(await submit(name.normalize('NFC').trim()))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登録できませんでした。')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title={result.reason === 'obstacle' ? '障害物にぶつかった！' : '追手に捕まった！'}>
      <div className="result-score">
        <div>
          <MapPin size={13} />
          滑走距離
        </div>
        <strong>
          {result.distance.toLocaleString()} <small>m</small>
        </strong>
        {result.newBest && (
          <span>
            <Trophy size={14} />
            自己ベスト更新
          </span>
        )}
      </div>
      <p className="evaded">
        <Crosshair size={16} />
        振り切った追手<strong>{result.eliminated} 人</strong>
      </p>
      <div className="result-actions">
        <button
          className="btn btn-primary full result-replay"
          onClick={replay}
          disabled={busy}
          autoFocus
        >
          <RotateCcw size={22} />
          もう一回滑る
        </button>
        <button className="btn btn-outline full" type="button" onClick={shareResult}>
          <Share2 size={17} />
          結果を共有
        </button>
        {shareStatus === 'copied' && (
          <p className="share-status" role="status">
            結果をコピーしました
          </p>
        )}
        {shareStatus === 'manual' && (
          <label className="manual-share">
            結果を選択してコピー
            <textarea
              readOnly
              value={shareMessage}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
        )}
      </div>
      {rank === null ? (
        <form onSubmit={save} className="dialog-form result-form">
          <label htmlFor="score-name">ランキングに載せる名前</label>
          <div className="input-row">
            <input
              id="score-name"
              autoComplete="nickname"
              placeholder="プレーヤー名（1〜16文字）"
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn btn-outline" disabled={busy}>
              {busy ? '送信中…' : '登録'}
              <ArrowUpRight size={14} />
            </button>
          </div>
          {error && (
            <p role="alert" className="message-error">
              {error}
            </p>
          )}
        </form>
      ) : (
        <div className="registered">
          <Check size={17} />
          登録しました<strong>自己ベスト順位 {rank} 位</strong>
        </div>
      )}
      <button className="text-button result-home" onClick={home} disabled={busy}>
        スタート画面に戻る
      </button>
    </Modal>
  )
}
