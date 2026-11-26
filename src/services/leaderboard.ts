import type { GameEdition } from '../game/edition'

export interface LeaderboardEntry {
  rank: number
  name: string
  distance: number
  isMe: boolean
}

export interface Leaderboard {
  entries: LeaderboardEntry[]
  me: LeaderboardEntry | null
}

const tokenKey = 'ski-game.device-token.v1'
const connectionError = 'ランキングに接続できません。通信状態を確認してください。'
let sessionToken: string | undefined

function deviceToken(): string {
  if (sessionToken) return sessionToken
  try {
    const saved = localStorage.getItem(tokenKey)
    if (saved && /^[0-9a-f]{64}$/.test(saved)) {
      sessionToken = saved
      return saved
    }
  } catch {
    // Storage may be disabled. The identity still lasts for this page session.
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  sessionToken = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  try {
    localStorage.setItem(tokenKey, sessionToken)
  } catch {
    // In-memory identity also supports immediate replay and score submission.
  }
  return sessionToken
}

async function apiRequest(
  endpoint: string,
  edition: GameEdition,
  method: 'GET' | 'POST',
  body?: object,
): Promise<unknown> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 9000)
  let response: Response
  let data: unknown
  try {
    const headers = new Headers({ Authorization: `Bearer ${deviceToken()}` })
    if (body) headers.set('Content-Type', 'application/json')
    response = await fetch(`/api/${endpoint}?edition=${edition}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    })
    data = await response.json()
  } catch {
    throw new Error(connectionError)
  } finally {
    window.clearTimeout(timeout)
  }
  if (!response.ok) {
    const message = isRecord(data) && typeof data.error === 'string' ? data.error : connectionError
    throw new Error(message)
  }
  return data
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isEntry(value: unknown): value is LeaderboardEntry {
  return (
    isRecord(value) &&
    typeof value.rank === 'number' &&
    typeof value.name === 'string' &&
    typeof value.distance === 'number' &&
    typeof value.isMe === 'boolean'
  )
}

function parseLeaderboard(data: unknown): Leaderboard {
  if (
    !isRecord(data) ||
    !Array.isArray(data.entries) ||
    !data.entries.every(isEntry) ||
    !(data.me === null || isEntry(data.me))
  ) {
    throw new Error(connectionError)
  }
  return { entries: data.entries, me: data.me }
}

export async function startRun(edition: GameEdition): Promise<string> {
  const data = await apiRequest('runs', edition, 'POST')
  if (!isRecord(data) || typeof data.runId !== 'string') throw new Error(connectionError)
  return data.runId
}

export async function getLeaderboard(edition: GameEdition): Promise<Leaderboard> {
  return parseLeaderboard(await apiRequest('leaderboard', edition, 'GET'))
}

export async function submitScore(
  edition: GameEdition,
  runId: string,
  name: string,
  distance: number,
): Promise<Leaderboard> {
  return parseLeaderboard(await apiRequest('leaderboard', edition, 'POST', { runId, name, distance }))
}
