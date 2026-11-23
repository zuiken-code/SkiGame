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
  Trophy,
  X,
} from 'lucide-react'
import { validName } from '../../services/profile'

function Modal({
  title,
  label,
  children,
  onClose,
}: {
  title: string
  label: string
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
        <span className="hero-label">
          <i />
          {label}
        </span>
        {onClose && (
          <button className="icon-button" aria-label="閉じる" onClick={onClose}>
            <X size={18} />
          </button>
        )}
      </div>
      <h2>{title}</h2>
      {children}
    </dialog>
  )
}

export function Guide({ close, start }: { close: () => void; start: () => void }) {
  return (
    <Modal title="操作ガイド" label="HOW TO PLAY" onClose={close}>
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
          <ArrowLeftRight />
          <p>
            <strong>左右にドラッグしてターン</strong>
            <span>岩や木を引きつけてかわすと、後ろの追手をぶつけて振り切れます。</span>
          </p>
        </div>
        <div>
          <ArrowDown />
          <p>
            <strong>手前に引いて減速</strong>
            <span>
              指を離すと通常速度に戻ります。障害物に当たると減速し、追手に触れると滑走終了です。
            </span>
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

export function ProfileDialog({
  current,
  close,
  save,
}: {
  current: string
  close: () => void
  save: (name: string) => void
}) {
  const [name, setName] = useState(current)
  const [error, setError] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!validName(name)) {
      setError('プレーヤー名は1〜16文字で入力してください。')
      return
    }
    save(name.normalize('NFC').trim())
  }
  return (
    <Modal title="プレーヤー設定" label="PLAYER PROFILE" onClose={close}>
      <form onSubmit={submit} className="dialog-form">
        <label htmlFor="player-name">プレーヤー名</label>
        <input
          id="player-name"
          autoComplete="nickname"
          placeholder="名前を入力"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="modal-lead">
          次にランキングへ登録するときに使う名前です。同じブラウザーから自分の順位を確認できます。
        </p>
        {error && (
          <p role="alert" className="message-error">
            {error}
          </p>
        )}
        <button className="btn btn-primary full" type="submit">
          <Check size={17} />
          保存する
        </button>
      </form>
    </Modal>
  )
}

export interface Result {
  distance: number
  eliminated: number
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
    <Modal title="滑走終了" label="RUN RESULT">
      <p className="modal-lead">追手に捕まった！</p>
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
      <div className="result-actions">
        <button className="btn btn-primary full" onClick={replay} disabled={busy}>
          <Play size={15} fill="currentColor" />
          もう一度滑る
        </button>
        <button className="text-button" onClick={home} disabled={busy}>
          ベースキャンプに戻る
        </button>
      </div>
    </Modal>
  )
}
