import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CornerDownLeft,
  Gauge,
  MountainSnow,
  Pause,
  Play,
  TriangleAlert,
  UsersRound,
} from 'lucide-react'
import { createGame, stepGame } from '../../game/simulation'
import type { GameState } from '../../game/simulation'
import { SkiScene } from '../../scene/SkiScene'
import SteeringSurface from './SteeringSurface'
import { useGameSound } from './useGameSound'
import './game.css'

type Phase = 'loading' | 'playing' | 'paused' | 'finished' | 'unavailable'

interface GameScreenProps {
  onExit: () => void
  onStart: () => void
  onFinish: (distance: number, eliminated: number) => void
  soundEnabled: boolean
}

function readHud(game: GameState) {
  const gap = game.enemies.reduce(
    (closest, rival) =>
      Math.min(closest, Math.hypot(rival.x - game.x, rival.distance - game.distance)),
    Infinity,
  )
  return {
    distance: Math.floor(game.distance),
    speed: Math.round(game.speed * 3.6),
    rivals: game.enemies.length,
    slowing: game.slowTimer > 0.35,
    danger: gap < 3,
    showHint: game.elapsed < 5.5,
  }
}

export default function GameScreen({ onExit, onFinish, onStart, soundEnabled }: GameScreenProps) {
  const [simulation] = useState(() => ({ current: createGame() }))
  const [phase, setPhase] = useState<Phase>('loading')
  const [confirmExit, setConfirmExit] = useState(false)
  const [hud, setHud] = useState(() => readHud(simulation.current))
  const phaseRef = useRef<Phase>(phase)
  const callbacks = useRef({ onStart, onFinish })
  const input = useRef({ steer: 0, brake: 0 })
  const { play, wake } = useGameSound(soundEnabled)

  useEffect(() => {
    callbacks.current = { onStart, onFinish }
  }, [onStart, onFinish])

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const sceneReady = useCallback(() => {
    if (phaseRef.current !== 'loading') return
    changePhase(document.hidden ? 'paused' : 'playing')
    if (!document.hidden && navigator.userActivation?.hasBeenActive) wake()
    callbacks.current.onStart()
  }, [changePhase, wake])

  const sceneUnavailable = useCallback(() => {
    if (phaseRef.current !== 'finished') changePhase('unavailable')
  }, [changePhase])

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    input.current = { steer: 0, brake: 0 }
    setHud(readHud(simulation.current))
    setConfirmExit(false)
    changePhase('paused')
  }, [changePhase, simulation])

  const resumeGame = useCallback(() => {
    if (phaseRef.current !== 'paused' || document.hidden) return
    wake()
    setConfirmExit(false)
    changePhase('playing')
  }, [changePhase, wake])

  useEffect(() => {
    function visibilityChange() {
      if (document.hidden) pauseGame()
    }
    function onKey(event: KeyboardEvent) {
      if ((event.code !== 'Escape' && event.code !== 'KeyP') || event.repeat) return
      if (phaseRef.current === 'playing') pauseGame()
      else if (phaseRef.current === 'paused') resumeGame()
    }
    document.addEventListener('visibilitychange', visibilityChange)
    window.addEventListener('blur', pauseGame)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('visibilitychange', visibilityChange)
      window.removeEventListener('blur', pauseGame)
      window.removeEventListener('keydown', onKey)
    }
  }, [pauseGame, resumeGame])

  useEffect(() => {
    if (phase !== 'playing') return
    const game = simulation.current
    let frame: number
    let last = performance.now()
    let lastHud = last
    function update(now: number) {
      if (phaseRef.current !== 'playing') return
      const previousHits = game.eliminated
      const previousSlow = game.slowTimer
      stepGame(game, input.current, (now - last) / 1000)
      last = now
      if (game.caught) {
        changePhase('finished')
        play('finish')
        callbacks.current.onFinish(Math.floor(game.distance), game.eliminated)
        return
      }
      if (game.eliminated > previousHits) play('escape')
      else if (game.slowTimer > previousSlow) play('impact')
      if (now - lastHud >= 90) {
        setHud(readHud(game))
        lastHud = now
      }
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [phase, simulation, changePhase, play])

  const showHud = phase === 'playing' || phase === 'paused'

  return (
    <main className="game-screen" aria-label="滑走コース">
      {phase !== 'unavailable' && (
        <div className="game-world">
          <SkiScene
            simulation={simulation}
            paused={phase === 'paused' || phase === 'finished'}
            onReady={sceneReady}
            onUnavailable={sceneUnavailable}
          />
        </div>
      )}
      {phase === 'playing' && <SteeringSurface input={input} wakeAudio={wake} />}
      {showHud && (
        <div className="ski-hud">
          <section className="ski-hud-distance" aria-label="滑走距離">
            <div className="ski-metric-label">
              <i />
              滑走距離
            </div>
            <div className="ski-distance-number">
              {hud.distance.toLocaleString('ja-JP')}
              <small>m</small>
            </div>
          </section>
          <div className="ski-hud-instruments">
            <span aria-label={'速度 ' + hud.speed + ' キロメートル毎時'}>
              <Gauge /> <b>{hud.speed}</b>
              <small>km/h</small>
            </span>
            <span aria-label={'追手 ' + hud.rivals + ' 人'}>
              <UsersRound /> <b>{hud.rivals}</b>
              <small>追手</small>
            </span>
          </div>
          {phase === 'playing' && (
            <button
              className="ski-pause-button"
              type="button"
              aria-label="一時停止"
              onClick={pauseGame}
            >
              <Pause size={19} fill="currentColor" strokeWidth={1} />
            </button>
          )}
        </div>
      )}
      {phase === 'playing' && (
        <div className="ski-feedback">
          {hud.slowing || hud.danger ? (
            <div className="ski-alert">
              <TriangleAlert size={15} />
              {hud.slowing ? '障害物に当たって減速！' : '追手が接近！'}
            </div>
          ) : (
            hud.showHint && (
              <div className="ski-control-hint">
                <span className="ski-touch-hint">画面を押して左右にターン · 手前に引いて減速</span>
                <span className="ski-key-hint">← → でターン · ↓ で減速</span>
              </div>
            )
          )}
        </div>
      )}
      {phase === 'loading' && (
        <div className="ski-cover">
          <div className="ski-loading" role="status">
            <MountainSnow size={32} />
            <span>コースを準備中…</span>
          </div>
          <button type="button" className="ski-loading-back" onClick={onExit}>
            ベースキャンプに戻る
          </button>
        </div>
      )}
      {phase === 'paused' && (
        <div className="ski-cover">
          <section
            className="ski-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-title"
          >
            <div className="ski-dialog-mark">
              <Pause fill="currentColor" size={19} />
            </div>
            <h2 id="pause-title">{confirmExit ? '滑走を終了しますか？' : '一時停止'}</h2>
            <p>
              {confirmExit
                ? '途中で終了すると、今回の距離はランキングに登録されません。'
                : '現在の滑走距離 ' +
                  Math.floor(simulation.current.distance).toLocaleString('ja-JP') +
                  ' m'}
            </p>
            <button
              type="button"
              className="ski-primary"
              autoFocus
              onClick={confirmExit ? onExit : resumeGame}
            >
              {confirmExit ? <CornerDownLeft size={17} /> : <Play size={16} fill="currentColor" />}
              {confirmExit ? '終了して戻る' : '滑走を再開'}
            </button>
            <button
              type="button"
              className="ski-secondary"
              onClick={() => setConfirmExit(!confirmExit)}
            >
              {confirmExit ? 'キャンセル' : 'ベースキャンプに戻る'}
            </button>
          </section>
        </div>
      )}
      {phase === 'unavailable' && (
        <div className="ski-cover">
          <section className="ski-dialog" role="alert">
            <div className="ski-dialog-mark">
              <TriangleAlert size={19} />
            </div>
            <h2>コースを表示できません</h2>
            <p>WebGL を利用できるブラウザーで、ページを開き直してください。</p>
            <button type="button" className="ski-primary" onClick={onExit}>
              ベースキャンプに戻る
            </button>
          </section>
        </div>
      )}
    </main>
  )
}
