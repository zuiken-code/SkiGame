const runLifetimeMs = 24 * 60 * 60 * 1000
const maxMetersPerSecond = 120
const distanceAllowance = 100

type ScoreRow = { player_id: string; name: string; distance: number }
type OwnScoreRow = ScoreRow & { rank: number }
type RunRow = { started_at: number; name: string | null; distance: number | null }

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store', Vary: 'Authorization' },
  })
}

function error(message: string, status: number) {
  return json({ error: message }, status)
}

// A public ranking response never includes the device token or its digest.
async function playerIdFor(token: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function leaderboard(db: D1Database, playerId: string | null) {
  const top = db.prepare(`
    SELECT player_id, name, distance FROM best_scores
    ORDER BY distance DESC, achieved_at ASC, player_id ASC LIMIT 10
  `)
  const mine = db
    .prepare(
      `
    SELECT s.*, 1 + (SELECT COUNT(*) FROM best_scores b WHERE b.distance > s.distance) AS rank
    FROM best_scores s WHERE s.player_id = ?
  `,
    )
    .bind(playerId)
  const [topResult, ownResult] = await db.batch<ScoreRow | OwnScoreRow>([top, mine])
  let rank = 1
  const entries = topResult.results.map((row, index, rows) => {
    if (index > 0 && row.distance !== rows[index - 1].distance) rank = index + 1
    return { rank, name: row.name, distance: row.distance, isMe: row.player_id === playerId }
  })
  const own = ownResult.results[0] as OwnScoreRow | undefined
  const me = own ? { rank: own.rank, name: own.name, distance: own.distance, isMe: true } : null
  return json({ entries, me })
}

async function startRun(db: D1Database, playerId: string) {
  const now = Date.now()
  const runId = crypto.randomUUID()
  await db.batch([
    db
      .prepare(
        `DELETE FROM runs WHERE id IN
      (SELECT id FROM runs WHERE started_at <= ? ORDER BY started_at LIMIT 32)`,
      )
      .bind(now - runLifetimeMs),
    db
      .prepare('INSERT INTO runs (id, player_id, started_at) VALUES (?, ?, ?)')
      .bind(runId, playerId, now),
  ])
  return json({ runId }, 201)
}

async function finishRun(request: Request, db: D1Database, playerId: string) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
    return error('JSON形式で送信してください。', 415)
  }
  let data: { runId?: unknown; name?: unknown; distance?: unknown } | null
  try {
    data = await request.json()
  } catch {
    return error('送信データを読み取れませんでした。', 400)
  }
  const runId = data?.runId
  const distance = data?.distance
  const name = typeof data?.name === 'string' ? data.name.normalize('NFC').trim() : ''
  if (typeof runId !== 'string' || !/^[0-9a-f-]{36}$/.test(runId)) {
    return error('滑走IDを確認できません。', 400)
  }
  if (typeof distance !== 'number' || !Number.isSafeInteger(distance) || distance < 0) {
    return error('滑走距離を確認できません。', 400)
  }
  if (
    [...name].length > 16 ||
    !/[\p{L}\p{N}\p{S}\p{P}]/u.test(name) ||
    /[\p{Cc}\u202a-\u202e\u2066-\u2069]/u.test(name)
  ) {
    return error('表示名は1〜16文字で入力してください。', 400)
  }

  const now = Date.now()
  // A completed session is immutable. Concurrent submits have a single winner.
  const update = db
    .prepare(
      `
    UPDATE runs SET finished_at = ?, name = ?, distance = ?
    WHERE id = ? AND player_id = ? AND finished_at IS NULL AND started_at > ?
      AND ? <= ((? - started_at) * ? / 1000.0 + ?)
  `,
    )
    .bind(
      now,
      name,
      distance,
      runId,
      playerId,
      now - runLifetimeMs,
      distance,
      now,
      maxMetersPerSecond,
      distanceAllowance,
    )
  const lookup = db
    .prepare('SELECT started_at, name, distance FROM runs WHERE id = ? AND player_id = ?')
    .bind(runId, playerId)
  const [, result] = await db.batch<RunRow>([update, lookup])
  const run = result.results[0]
  if (!run || run.started_at <= now - runLifetimeMs) {
    return error('この滑走の登録期限が切れました。', 410)
  }
  if (run.distance === null) return error('滑走時間と距離が一致しません。', 422)
  if (run.distance !== distance || run.name !== name) {
    return error('この滑走はすでに別の内容で登録されています。', 409)
  }
  return leaderboard(db, playerId)
}

export const onRequest: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  const endpoint = new URL(request.url).pathname.replace(/\/$/, '')
  const { method } = request
  if (endpoint !== '/api/runs' && endpoint !== '/api/leaderboard') {
    return error('APIが見つかりません。', 404)
  }
  if (method !== 'POST' && !(method === 'GET' && endpoint === '/api/leaderboard')) {
    const response = error('この操作には対応していません。', 405)
    response.headers.set('Allow', endpoint === '/api/runs' ? 'POST' : 'GET, POST')
    return response
  }

  try {
    const authorization = request.headers.get('Authorization')
    const match = authorization?.match(/^Bearer ([0-9a-f]{64})$/)
    if (authorization && !match) return error('プレーヤーIDを確認できません。', 401)
    const playerId = match ? await playerIdFor(match[1]) : null
    if (method === 'GET') return await leaderboard(env.DB, playerId)
    if (!playerId) return error('プレーヤーIDが必要です。', 401)
    if (endpoint === '/api/runs') return await startRun(env.DB, playerId)
    return await finishRun(request, env.DB, playerId)
  } catch (cause) {
    console.error(
      'Leaderboard database request failed',
      cause instanceof Error ? cause.name : 'unknown error',
    )
    return error('ランキングに接続できません。少し待ってから再試行してください。', 503)
  }
}
