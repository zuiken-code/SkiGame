import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { ScoreList, OwnRank, type BoardState } from './components/Ranking/Ranking'
import { Guide, Modal, ResultDialog, type Result } from './components/Dialogs/Dialogs'
import type { RunControls } from './components/Game/GameScreen'
import { readProfile, writeProfile } from './services/profile'
import { getLeaderboard, startRun, submitScore } from './services/leaderboard'

const GameScreen = lazy(() => import('./components/Game/GameScreen'))

export default function App() {
  const [modal, setModal] = useState<'guide' | 'ranking' | null>(null)
  const [profile, setProfile] = useState(readProfile)
  const [board, setBoard] = useState<BoardState>({ data: null, loading: true, error: '' })
  const [result, setResult] = useState<Result | null>(null)
  const runId = useRef<Promise<string | null> | null>(null)
  const controls = useRef<RunControls>(null)
  const requestVersion = useRef(0)

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current
    setBoard((current) => ({ ...current, loading: true, error: '' }))
    try {
      const data = await getLeaderboard()
      if (version === requestVersion.current) setBoard({ data, loading: false, error: '' })
    } catch (cause) {
      if (version === requestVersion.current)
        setBoard((current) => ({ ...current, loading: false, error: String(cause) }))
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])
  useEffect(() => {
    writeProfile(profile)
  }, [profile])

  const onStart = useCallback(() => {
    runId.current = startRun().catch(() => null)
    setResult(null)
    setModal(null)
  }, [])
  const onFinish = useCallback(
    (rawDistance: number, eliminated: number) => {
      const distance = Math.floor(rawDistance)
      setResult({
        distance,
        eliminated,
        newBest: distance > Math.max(profile.best, board.data?.me?.distance ?? 0),
      })
      setProfile((p) => ({
        ...p,
        runs: p.runs + 1,
        best: Math.max(p.best, distance),
        eliminated: p.eliminated + eliminated,
      }))
    },
    [profile.best, board.data?.me?.distance],
  )
  async function register(name: string) {
    const id = await runId.current
    if (!id || !result)
      throw new Error(
        '開始時にランキングへ接続できませんでした。今回の距離はマイレコードに保存しました。',
      )
    const data = await submitScore(id, name, result.distance)
    requestVersion.current++
    setBoard({ data, loading: false, error: '' })
    setProfile((p) => ({ ...p, name }))
    if (!data.me) throw new Error('順位を取得できませんでした。もう一度登録してください。')
    return data.me.rank
  }

  return (
    <>
      <Suspense
        fallback={
          <div className="game-loading" role="status">
            <LoaderCircle className="spin" />
            コースを準備中…
          </div>
        }
      >
        <GameScreen
          ref={controls}
          soundEnabled={profile.sound}
          best={Math.max(profile.best, board.data?.me?.distance ?? 0)}
          onStart={onStart}
          onFinish={onFinish}
          onGuide={() => setModal('guide')}
          onRanking={() => {
            setModal('ranking')
            void refresh()
          }}
          onSound={() => setProfile((p) => ({ ...p, sound: !p.sound }))}
        />
      </Suspense>
      {modal === 'guide' && (
        <Guide close={() => setModal(null)} start={() => controls.current?.start()} />
      )}
      {modal === 'ranking' && (
        <Modal title="ランキング" onClose={() => setModal(null)}>
          <ScoreList board={board} limit={10} refresh={refresh} />
          <OwnRank board={board} />
        </Modal>
      )}
      {result && (
        <ResultDialog
          result={result}
          currentName={profile.name}
          submit={register}
          replay={() => controls.current?.start()}
          home={() => {
            setResult(null)
            controls.current?.reset()
          }}
        />
      )}
    </>
  )
}
