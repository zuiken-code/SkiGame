import { ArrowLeft, FlagTriangleRight, LoaderCircle, RotateCw, Trophy } from 'lucide-react'
import type { Leaderboard, LeaderboardEntry } from '../../services/leaderboard'

export interface BoardState {
  data: Leaderboard | null
  loading: boolean
  error: string
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div className={`rank-row ${entry.isMe ? 'is-me' : ''}`}>
      <span className={`ordinal place-${entry.rank}`}>{String(entry.rank).padStart(2, '0')}</span>
      <span className="rank-name">
        {entry.name}
        {entry.isMe && <small>自分</small>}
      </span>
      <strong>
        {entry.distance.toLocaleString()} <small>m</small>
      </strong>
    </div>
  )
}

export function ScoreList({
  board,
  limit,
  refresh,
}: {
  board: BoardState
  limit: number
  refresh: () => void
}) {
  const rows = board.data?.entries.slice(0, limit) ?? []
  return (
    <div className="score-list" aria-live="polite">
      <div className="table-head">
        <span>順位</span>
        <span>プレーヤー</span>
        <span>滑走距離</span>
      </div>
      {rows.map((entry, i) => (
        <Row entry={entry} key={i} />
      ))}
      {board.error ? (
        <div className="empty-score">
          <span>ランキングを取得できませんでした</span>
          <button className="text-button" onClick={refresh}>
            <RotateCw size={13} />
            再読み込み
          </button>
        </div>
      ) : (
        !rows.length && (
          <div className="empty-score">
            {board.loading ? (
              <>
                <LoaderCircle className="spin" />
                <span>読み込み中…</span>
              </>
            ) : (
              <>
                <FlagTriangleRight size={25} strokeWidth={1.4} />
                <span>まだ滑走記録がありません</span>
                <small>最初の記録を残そう。</small>
              </>
            )}
          </div>
        )
      )}
    </div>
  )
}

export function Ranking({
  board,
  refresh,
  back,
}: {
  board: BoardState
  refresh: () => void
  back: () => void
}) {
  return (
    <main className="rank-page wrap">
      <button className="text-button back" onClick={back}>
        <ArrowLeft size={16} />
        ベースキャンプ
      </button>
      <div className="rank-title">
        <div>
          <div className="hero-label">
            <i /> LEADERBOARD
          </div>
          <h1>ランキング</h1>
        </div>
        <button
          className="icon-button"
          aria-label="ランキングを更新"
          onClick={refresh}
          disabled={board.loading}
        >
          <RotateCw size={18} className={board.loading ? 'spin' : ''} />
        </button>
      </div>
      <div className="panel ranking-panel">
        <div className="panel-heading">
          <div className="heading-icon">
            <Trophy />
          </div>
          <div>
            <span className="kicker">DISTANCE RANKING</span>
            <h2>滑走距離 TOP 10</h2>
          </div>
        </div>
        <ScoreList board={board} limit={10} refresh={refresh} />
      </div>
      <div className="panel own-ranking">
        <h2>自分の順位</h2>
        {board.data?.me ? (
          <Row entry={board.data.me} />
        ) : (
          <p>
            {board.error
              ? 'ランキングに接続すると確認できます。'
              : board.loading
                ? '読み込み中…'
                : '滑走後にプレーヤー名と記録を登録すると表示されます。'}
          </p>
        )}
      </div>
    </main>
  )
}
