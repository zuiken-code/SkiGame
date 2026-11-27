import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { EditionPicker, ScoreList, OwnRank, type BoardState } from './components/Ranking/Ranking'
import { Guide, Modal, ResultDialog, type Result } from './components/Dialogs/Dialogs'
import type { RunControls } from './components/Game/GameScreen'
import { ModePicker } from './components/Game/ModePicker'
import type { GameEdition } from './game/edition'
import type { RunEndReason } from './game/simulation'
import { readProfile, writeProfile } from './services/profile'
import { getLeaderboard, startRun, submitScore } from './services/leaderboard'

const GameScreen = lazy(() => import('./components/Game/GameScreen'))
const loadingBoard: BoardState = { data: null, loading: true, error: '' }

export default function App() {
  const [modal, setModal] = useState<'guide' | 'ranking' | 'modes' | null>(null)
  const [rankingEdition, setRankingEdition] = useState<GameEdition>('classic')
  const [profile, setProfile] = useState(readProfile)
  const [boards, setBoards] = useState<Record<GameEdition, BoardState>>({
    new: loadingBoard,
    classic: loadingBoard,
  })
  const [result, setResult] = useState<Result | null>(null)
  const run = useRef<{ edition: GameEdition; id: Promise<string | null> } | null>(null)
  const controls = useRef<RunControls>(null)
  const requestVersions = useRef({ new: 0, classic: 0 })
  const bestByEdition = useMemo(
    () => ({
      classic: Math.max(profile.records.classic.best, boards.classic.data?.me?.distance ?? 0),
      new: Math.max(profile.records.new.best, boards.new.data?.me?.distance ?? 0),
    }),
    [profile.records, boards],
  )

  const refresh = useCallback(async (target: GameEdition) => {
    const version = ++requestVersions.current[target]
    setBoards((current) => ({
      ...current,
      [target]: { ...current[target], loading: true, error: '' },
    }))
    try {
      const data = await getLeaderboard(target)
      if (version === requestVersions.current[target]) {
        setBoards((current) => ({ ...current, [target]: { data, loading: false, error: '' } }))
      }
    } catch (cause) {
      if (version === requestVersions.current[target]) {
        setBoards((current) => ({
          ...current,
          [target]: { ...current[target], loading: false, error: String(cause) },
        }))
      }
    }
  }, [])
  useEffect(() => {
    writeProfile(profile)
  }, [profile])

  const onStart = useCallback((edition: GameEdition) => {
    run.current = { edition, id: startRun(edition).catch(() => null) }
    setResult(null)
    setModal(null)
  }, [])
  const onFinish = useCallback(
    (edition: GameEdition, rawDistance: number, eliminated: number, reason: RunEndReason) => {
      const distance = Math.floor(rawDistance)
      setResult({
        edition,
        distance,
        eliminated,
        reason,
        newBest: distance > bestByEdition[edition],
      })
      setProfile((p) => ({
        ...p,
        records: {
          ...p.records,
          [edition]: {
            runs: p.records[edition].runs + 1,
            best: Math.max(p.records[edition].best, distance),
            eliminated: p.records[edition].eliminated + eliminated,
          },
        },
      }))
    },
    [bestByEdition],
  )
  async function register(name: string) {
    const active = run.current
    const id = active && active.edition === result?.edition ? await active.id : null
    if (!id || !result)
      throw new Error(
        '開始時にランキングへ接続できませんでした。今回の距離はマイレコードに保存しました。',
      )
    const target = result.edition
    const data = await submitScore(target, id, name, result.distance)
    requestVersions.current[target]++
    setBoards((current) => ({ ...current, [target]: { data, loading: false, error: '' } }))
    setProfile((p) => ({ ...p, name }))
    if (!data.me) throw new Error('順位を取得できませんでした。もう一度登録してください。')
    return data.me.rank
  }

  function showRanking(target: GameEdition) {
    setRankingEdition(target)
    void refresh(target)
  }

  function chooseMode() {
    setModal('modes')
    void refresh('classic')
    void refresh('new')
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
          onChooseMode={chooseMode}
          onStart={onStart}
          onFinish={onFinish}
          onGuide={() => setModal('guide')}
          onRanking={() => {
            setModal('ranking')
            showRanking(run.current?.edition ?? 'classic')
          }}
          onSound={() => setProfile((p) => ({ ...p, sound: !p.sound }))}
        />
      </Suspense>
      {modal === 'guide' && <Guide close={() => setModal(null)} chooseMode={chooseMode} />}
      {modal === 'modes' && (
        <ModePicker
          best={bestByEdition}
          onClose={() => setModal(null)}
          onSelect={(edition) => controls.current?.start(edition)}
        />
      )}
      {modal === 'ranking' && (
        <Modal title="ランキング" onClose={() => setModal(null)}>
          <EditionPicker edition={rankingEdition} onChange={showRanking} />
          <ScoreList
            board={boards[rankingEdition]}
            limit={10}
            refresh={() => void refresh(rankingEdition)}
          />
          <OwnRank board={boards[rankingEdition]} />
        </Modal>
      )}
      {result && (
        <ResultDialog
          result={result}
          currentName={profile.name}
          submit={register}
          replay={() => controls.current?.start(result.edition)}
          home={() => {
            setResult(null)
            controls.current?.reset()
          }}
        />
      )}
    </>
  )
}
