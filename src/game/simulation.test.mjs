import assert from 'node:assert/strict'
import test from 'node:test'
import { courseCenter, createGame, RIVAL_FALL_TIME, stepGame } from './simulation.ts'
import { readStick } from './joystick.ts'

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

test('a sliding rival can be tripped from well behind and stops until it recovers', () => {
  const game = createGame(71)
  const [rival] = game.enemies
  rival.x = -0.25
  rival.distance = -6.5
  stepGame(game, neutral, tick)
  assert.ok(rival.slideTimer > 0)
  while (game.falls === 0 && !game.caught && game.elapsed < 0.24) {
    stepGame(game, { steer: 1, brake: 0 }, tick)
  }
  assert.equal(game.caught, false)
  assert.equal(game.falls, 1)
  assert.ok(game.distance - rival.distance > 5)
  assert.equal(rival.fallTimer, RIVAL_FALL_TIME)
  assert.equal(rival.slideTimer, 0)
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
  game.enemies = game.enemies.slice(0, 1)
  const [rival] = game.enemies
  rival.distance = -14
  for (let frame = 0; frame < 30; frame++) stepGame(game, { steer: 1, brake: 0 }, tick)
  rival.x = game.x - 1
  rival.distance = game.distance - 5
  stepGame(game, { steer: 1, brake: 0 }, tick)
  assert.ok(rival.slideTimer > 0)
  assert.equal(game.falls, 0)
})

test('a distant rival keeps pursuing instead of sliding or falling', () => {
  const game = createGame(41)
  const [rival] = game.enemies
  game.enemies = [rival]
  rival.distance = -12
  for (let frame = 0; frame < 20; frame++) stepGame(game, { steer: 1, brake: 0 }, tick)
  assert.equal(rival.slideTimer, 0)
  assert.equal(rival.fallTimer, 0)
})

test('steering across the course and riding the boundary keep downhill speed', () => {
  const straight = createGame(91)
  const turning = createGame(91)
  for (const game of [straight, turning]) {
    game.enemies = []
    game.obstacles = []
  }
  for (let frame = 0; frame < 105; frame++) {
    stepGame(straight, neutral, tick)
    stepGame(turning, readStick(50, 16), tick)
  }
  assert.ok(turning.x > 9)
  assert.equal(turning.distance, straight.distance)
  assert.equal(turning.speed, straight.speed)
  stepGame(turning, readStick(0, 43), tick)
  assert.ok(turning.speed < straight.speed)
})

test('repeated reactions to sliding rivals can trip several in a single run', () => {
  const game = createGame(3)
  let turn = 0
  let framesLeft = 0
  while (!game.caught && game.distance < 600) {
    const center = courseCenter(game.distance)
    const sliding = game.enemies.find((rival) => rival.slideTimer > 0)
    if (framesLeft === 0 && sliding && !game.strongSteer) {
      turn = game.x >= sliding.x ? 1 : -1
      framesLeft = 10
    }
    const obstacle = game.obstacles.find(
      (item) =>
        item.distance > game.distance - 0.5 &&
        item.distance < game.distance + 10 &&
        Math.abs(item.x - game.x) < 1.7,
    )
    let steer = framesLeft > 0 ? turn : Math.max(-0.63, Math.min(0.63, (center - game.x) * 0.4))
    if (obstacle) steer = game.x > obstacle.x ? 1 : -1
    framesLeft = Math.max(0, framesLeft - 1)
    stepGame(game, { steer, brake: 0 }, tick)
  }
  assert.ok(game.distance >= 600)
  assert.ok(game.falls >= 4)
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
