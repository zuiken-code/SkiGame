import { FlagTriangleRight, LoaderCircle, RotateCw } from 'lucide-react'
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

export function OwnRank({ board }: { board: BoardState }) {
  return (
    <section className="own-ranking">
      <h3>自分の順位</h3>
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
    </section>
  )
}
