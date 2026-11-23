import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Header, type Page } from './components/Navigation/Header'
import { Lobby } from './components/Lobby/Lobby'
import { Ranking, type BoardState } from './components/Ranking/Ranking'
import { Guide, ProfileDialog, ResultDialog, type Result } from './components/Dialogs/Dialogs'
import { readProfile, writeProfile } from './services/profile'
import { getLeaderboard, startRun, submitScore } from './services/leaderboard'

const GameScreen = lazy(() => import('./components/Game/GameScreen'))

export default function App() {
  const [page, setPage] = useState<Page>('lobby')
  const [modal, setModal] = useState<'guide' | 'profile' | null>(null)
  const [profile, setProfile] = useState(readProfile)
  const [board, setBoard] = useState<BoardState>({ data: null, loading: true, error: '' })
  const [runKey, setRunKey] = useState<number | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const runId = useRef<Promise<string | null> | null>(null)
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

  function navigate(to: Page) {
    setPage(to)
    setModal(null)
    window.scrollTo(0, 0)
    if (to === 'ranking') void refresh()
  }
  function launch() {
    setResult(null)
    setModal(null)
    runId.current = null
    setRunKey((key) => (key ?? 0) + 1)
    window.scrollTo(0, 0)
  }
  const onStart = useCallback(() => {
    runId.current ??= startRun().catch(() => null)
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
  function exit() {
    setRunKey(null)
    setResult(null)
    navigate('lobby')
  }
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

  if (runKey !== null)
    return (
      <>
        <Suspense
          fallback={
            <div className="game-loading">
              <LoaderCircle className="spin" />
              コースを準備中…
            </div>
          }
        >
          <GameScreen
            key={runKey}
            soundEnabled={profile.sound}
            onStart={onStart}
            onFinish={onFinish}
            onExit={exit}
          />
        </Suspense>
        {result && (
          <ResultDialog
            result={result}
            currentName={profile.name}
            submit={register}
            replay={launch}
            home={exit}
          />
        )}
      </>
    )

  return (
    <>
      <Header
        page={page}
        onPage={navigate}
        name={profile.name}
        sound={profile.sound}
        toggleSound={() => setProfile((p) => ({ ...p, sound: !p.sound }))}
        onProfile={() => setModal('profile')}
      />
      {page === 'lobby' ? (
        <Lobby
          profile={profile}
          board={board}
          start={launch}
          guide={() => setModal('guide')}
          ranking={() => navigate('ranking')}
          refresh={refresh}
        />
      ) : (
        <Ranking board={board} back={() => navigate('lobby')} refresh={refresh} />
      )}
      {modal === 'guide' && <Guide close={() => setModal(null)} start={launch} />}
      {modal === 'profile' && (
        <ProfileDialog
          current={profile.name}
          close={() => setModal(null)}
          save={(name) => {
            setProfile((p) => ({ ...p, name }))
            setModal(null)
          }}
        />
      )}
    </>
  )
}
