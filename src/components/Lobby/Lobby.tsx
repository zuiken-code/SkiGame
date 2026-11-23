import {
  ArrowUpRight,
  Crosshair,
  FlagTriangleRight,
  Gamepad2,
  MapPin,
  MountainSnow,
  Play,
  Route,
  Trophy,
} from 'lucide-react'
import type { Profile } from '../../services/profile'
import type { BoardState } from '../Ranking/Ranking'
import { ScoreList } from '../Ranking/Ranking'

interface Props {
  profile: Profile
  board: BoardState
  start: () => void
  guide: () => void
  ranking: () => void
  refresh: () => void
}

export function Lobby({ profile, board, start, guide, ranking, refresh }: Props) {
  const best = Math.max(profile.best, board.data?.me?.distance ?? 0)
  return (
    <main className="lobby wrap">
      <section className="hero" aria-labelledby="game-title">
        <img className="hero-art" src="/powder-chase.jpg" alt="" fetchPriority="high" />
        <div className="hero-shade" />
        <div className="hero-content">
          <span className="hero-label">
            <i /> ENDLESS SKI CROSS
          </span>
          <h1 id="game-title">
            POWDER
            <br />
            <em>CHASE</em>
            <span className="speed-stripes" aria-hidden="true">
              <b />
              <b />
              <b />
            </span>
          </h1>
          <p>追手をかわし、雪山をどこまでも滑り抜けろ。</p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={start}>
              <Play size={17} fill="currentColor" />
              滑走スタート
            </button>
            <button className="btn btn-glass" onClick={guide}>
              <Gamepad2 size={19} />
              操作ガイド
            </button>
          </div>
        </div>
        <div className="course-label">
          <MapPin size={12} /> ALPINE RIDGE
        </div>
      </section>
      <div className="dashboard">
        <section className="panel stats">
          <div className="panel-heading">
            <div className="heading-icon">
              <Route />
            </div>
            <div>
              <span className="kicker">RUN STATS</span>
              <h2>マイレコード</h2>
            </div>
          </div>
          <div className="best-stat">
            <div className="topography" aria-hidden="true" />
            <MountainSnow className="record-mountain" aria-hidden="true" strokeWidth={1.1} />
            <div className="best-label">
              <FlagTriangleRight size={14} />
              自己ベスト
            </div>
            <div className="big-number">
              {best.toLocaleString()}
              <small>m</small>
            </div>
          </div>
          <div className="stat-pair">
            <div>
              <Route size={16} />
              <span>滑走回数</span>
              <strong>
                {profile.runs.toLocaleString()}
                <small>回</small>
              </strong>
            </div>
            <div>
              <Crosshair size={16} />
              <span>振り切った追手</span>
              <strong>
                {profile.eliminated.toLocaleString()}
                <small>人</small>
              </strong>
            </div>
          </div>
        </section>
        <section className="panel board-preview">
          <div className="panel-heading">
            <div className="heading-icon">
              <Trophy />
            </div>
            <div>
              <span className="kicker">LEADERBOARD</span>
              <h2>ランキング</h2>
            </div>
            <button className="text-button panel-link" onClick={ranking}>
              すべて見る <ArrowUpRight size={15} />
            </button>
          </div>
          <ScoreList board={board} limit={3} refresh={refresh} />
        </section>
      </div>
    </main>
  )
}
