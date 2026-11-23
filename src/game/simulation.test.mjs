import assert from 'node:assert/strict'
import test from 'node:test'
import { courseCenter, createGame, RIVAL_FALL_TIME, stepGame } from './simulation.ts'

const neutral = { steer: 0, brake: 0 }
const tick = 1 / 60

test('a seeded run has the same physics at different display refresh rates', () => {
  const slow = createGame(42)
  const fast = createGame(42)
  for (let frame = 0; frame < 60; frame++) stepGame(slow, neutral, 1 / 30)
  for (let frame = 0; frame < 240; frame++) stepGame(fast, neutral, 1 / 120)
  assert.equal(fast.distance, slow.distance)
  assert.deepEqual(fast.enemies, slow.enemies)
  assert.deepEqual(fast.obstacles, slow.obstacles)
})

test('a player impact slows once and riding through the obstacle can continue', () => {
  const state = createGame(12)
  const rock = state.obstacles[0]
  state.x = rock.x
  state.distance = rock.distance - state.speed * tick
  const speedBefore = state.speed
  stepGame(state, neutral, tick)
  const hitSpeed = state.speed
  assert.ok(hitSpeed <= speedBefore * 0.52)
  assert.ok(state.slowTimer > 0)
  assert.equal(state.caught, false)
  stepGame(state, neutral, tick)
  assert.ok(state.speed > hitSpeed)
})

test('enemies disappear on obstacles and new pursuers arrive', () => {
  const state = createGame(123)
  const enemy = state.enemies[0]
  const obstacle = state.obstacles[0]
  state.distance = obstacle.distance + 5
  enemy.distance = obstacle.distance - 0.1
  enemy.x = obstacle.x
  stepGame(state, neutral, tick)
  assert.equal(state.enemies.length, 2)
  assert.ok(!state.enemies.includes(enemy))
  assert.equal(state.eliminated, 1)
  state.nextEnemyAt = state.elapsed + tick
  stepGame(state, neutral, tick)
  assert.equal(state.enemies.length, 3)
  assert.ok(state.enemies.at(-1).distance < state.distance)
})

test('touching the pursuer ends the run and freezes the final distance', () => {
  const state = createGame(7)
  state.enemies[0].x = state.x
  state.enemies[0].distance = state.distance - 0.1
  stepGame(state, neutral, tick)
  const finish = state.distance
  assert.equal(state.caught, true)
  stepGame(state, { steer: 1, brake: 1 }, 0.2)
  assert.equal(state.distance, finish)
})

test('a last-second outward carve drops a rival in place until it recovers', () => {
  const game = createGame(71)
  const [rival] = game.enemies
  rival.x = -0.25
  rival.distance = -1.45
  while (game.falls === 0 && !game.caught && game.elapsed < 0.24) {
    stepGame(game, { steer: 1, brake: 0 }, tick)
  }
  assert.equal(game.caught, false)
  assert.equal(game.falls, 1)
  assert.equal(rival.fallTimer, RIVAL_FALL_TIME)
  const fallDistance = rival.distance
  const fallX = rival.x
  game.enemies = [rival]
  for (let frame = 0; frame < 100; frame++) stepGame(game, neutral, tick)
  assert.equal(rival.distance, fallDistance)
  assert.equal(rival.x, fallX)
  for (let frame = 0; frame < 12; frame++) stepGame(game, neutral, tick)
  assert.ok(rival.distance > fallDistance)
})

test('a held turn started too early does not trip a rival', () => {
  const game = createGame(41)
  for (let frame = 0; frame < 30; frame++) stepGame(game, { steer: 1, brake: 0 }, tick)
  const [rival] = game.enemies
  rival.x = game.x
  rival.distance = game.distance - 0.1
  stepGame(game, { steer: 1, brake: 0 }, tick)
  assert.equal(game.falls, 0)
  assert.equal(game.caught, true)
})

test('aiming at obstacles and turning away late can eliminate successive pursuers', () => {
  const state = createGame(5)
  while (!state.caught && state.distance < 600) {
    const obstacle = state.obstacles.find(
      (item) => item.distance > state.distance - 1.4 && item.distance < state.distance + 21,
    )
    let offset = 0
    if (obstacle) {
      offset = obstacle.x - courseCenter(obstacle.distance)
      if (obstacle.distance - state.distance < 8) offset += offset < 0 ? 2.1 : -2.1
    }
    const target = courseCenter(state.distance) + offset
    stepGame(state, { steer: (target - state.x) * 0.72, brake: 0 }, tick)
  }
  assert.ok(state.distance >= 600)
  assert.ok(state.eliminated >= 3)
})
