import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import worker from '../worker/index.ts'

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  sqlite.exec(readFileSync(new URL('../migrations/0001_leaderboard.sql', import.meta.url), 'utf8'))

  // Mirror D1's parameter binding and atomic batches against real SQLite.
  const DB = {
    prepare(sql) {
      const statement = sqlite.prepare(sql)
      const query = (...args) => ({ execute: () => statement.all(...args) })
      return { ...query(), bind: query }
    },
    batch(statements) {
      sqlite.exec('BEGIN')
      try {
        const results = statements.map((statement) => ({ results: statement.execute() }))
        sqlite.exec('COMMIT')
        return results
      } catch (cause) {
        sqlite.exec('ROLLBACK')
        throw cause
      }
    },
  }

  async function request(player, endpoint, method, body) {
    const token = player.toString(16).padStart(64, '0')
    const request = new Request(`https://game.test/api/${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    return worker.fetch(request, { DB })
  }
  return {
    async start(player) {
      const response = await request(player, 'runs', 'POST')
      assert.equal(response.status, 201)
      return (await response.json()).runId
    },
    finish: (player, runId, distance) =>
      request(player, 'leaderboard', 'POST', { runId, distance, name: `Skier ${player}` }),
    read: (player) => request(player, 'leaderboard', 'GET'),
  }
}

test('equal distances tie and a player outside the top ten can see their rank', async (t) => {
  const api = fixture(t)
  for (let player = 1; player <= 12; player++) {
    const run = await api.start(player)
    const distance = player <= 2 ? 90 : 90 - player
    assert.equal((await api.finish(player, run, distance)).status, 200)
  }
  const { entries, me } = await (await api.read(12)).json()
  assert.equal(entries.length, 10)
  assert.deepEqual(
    entries.slice(0, 3).map((entry) => entry.rank),
    [1, 1, 3],
  )
  assert.ok(entries.every((entry) => !entry.isMe))
  assert.deepEqual(me, { rank: 12, name: 'Skier 12', distance: 78, isMe: true })
})

test('retrying a score is idempotent and a shorter run preserves the personal best', async (t) => {
  const api = fixture(t)
  const run = await api.start(1)
  for (const response of await Promise.all([api.finish(1, run, 80), api.finish(1, run, 80)])) {
    assert.equal(response.status, 200)
  }
  assert.equal((await api.finish(1, run, 81)).status, 409)
  const shorter = await api.start(1)
  const { entries, me } = await (await api.finish(1, shorter, 50)).json()
  assert.equal(entries.length, 1)
  assert.equal(me.distance, 80)
})
