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

test('hitting a rock or tree ends the run on the collision tick and freezes the distance', () => {
  for (const kind of ['rock', 'pine']) {
    const state = createGame(12)
    const obstacle = state.obstacles.find((item) => item.kind === kind)
    state.x = obstacle.x
    state.distance = obstacle.distance - state.speed * tick
    stepGame(state, neutral, tick)
    assert.equal(state.endReason, 'obstacle')
    const finish = state.distance
    const elapsed = state.elapsed
    stepGame(state, { steer: 1, brake: 1 }, 0.2)
    assert.equal(state.distance, finish)
    assert.equal(state.elapsed, elapsed)
  }
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

test('glove contact from behind or from either side ends the run before body contact', () => {
  for (const [x, distance] of [
    [0, -3.1],
    [-3.0, 0],
    [3.0, 0],
  ]) {
    const state = createGame(7)
    const [rival] = state.enemies
    state.enemies = [rival]
    rival.x = x
    rival.distance = distance
    stepGame(state, neutral, tick)
    assert.ok(rival.reachTimer > 0)
    if (x) assert.equal(rival.reachX, -Math.sign(x))
    else assert.equal(rival.reachDownhill, 1)
    for (let frame = 0; frame < 65 && !state.endReason; frame++) stepGame(state, neutral, tick)
    assert.equal(state.endReason, 'caught')
    assert.ok(Math.hypot(state.x - rival.x, state.distance - rival.distance) > 0.8)
    const finish = state.distance
    stepGame(state, { steer: 1, brake: 1 }, 0.2)
    assert.equal(state.distance, finish)
  }
})

test('passing close to a rival outside the reach of its gloves is safe', () => {
  const game = createGame(7)
  const [rival] = game.enemies
  game.enemies = [rival]
  rival.x = game.x
  rival.distance = game.distance - 0.1
  rival.reachTimer = 0.6
  rival.reachX = 1
  rival.reachDownhill = 0
  stepGame(game, neutral, tick)
  assert.ok(Math.hypot(game.x - rival.x, game.distance - rival.distance) < 0.7)
  assert.equal(game.endReason, null)
})

test('a reaching rival can be tripped from behind and stops until it recovers', () => {
  const game = createGame(71)
  const [rival] = game.enemies
  rival.x = -0.25
  rival.distance = -3.5
  stepGame(game, neutral, tick)
  assert.ok(rival.reachTimer > 0)
  while (game.falls === 0 && !game.endReason && game.elapsed < 0.24) {
    stepGame(game, { steer: 1, brake: 0 }, tick)
  }
  assert.equal(game.endReason, null)
  assert.equal(game.falls, 1)
  assert.ok(game.distance - rival.distance > 2.5)
  assert.equal(rival.fallTimer, RIVAL_FALL_TIME)
  assert.equal(rival.reachTimer, 0)
  const fallDistance = rival.distance
  const fallX = rival.x
  game.enemies = [rival]
  for (let frame = 0; frame < 100; frame++) stepGame(game, neutral, tick)
  assert.equal(rival.distance, fallDistance)
  assert.equal(rival.x, fallX)
  for (let frame = 0; frame < 12; frame++) stepGame(game, neutral, tick)
  assert.ok(rival.distance > fallDistance)
})

test('a sharp turn away trips a rival reaching from the side', () => {
  const game = createGame(16)
  const [rival] = game.enemies
  game.enemies = [rival]
  rival.x = 3
  rival.distance = 0
  stepGame(game, neutral, tick)
  assert.equal(rival.reachX, -1)
  for (let frame = 0; frame < 16 && !game.falls && !game.endReason; frame++) {
    stepGame(game, { steer: -1, brake: 0 }, tick)
  }
  assert.equal(game.endReason, null)
  assert.equal(game.falls, 1)
})

test('a missed reach ends in a fall even without a sharp turn', () => {
  const game = createGame(52)
  const [rival] = game.enemies
  game.enemies = [rival]
  rival.distance = -3.4
  rival.x = game.x
  stepGame(game, neutral, tick)
  assert.ok(rival.reachTimer > 0)
  // Gently change lanes while the rival is committed straight downhill.
  for (let frame = 0; frame < 75 && !game.falls && !game.endReason; frame++) {
    stepGame(game, { steer: 0.48, brake: 0 }, tick)
  }
  assert.equal(game.endReason, null)
  assert.equal(game.falls, 1)
  assert.equal(rival.reachTimer, 0)
  assert.equal(rival.fallTimer, RIVAL_FALL_TIME)
  assert.equal(rival.lateralSpeed, 0)
  const fallenAt = rival.distance
  stepGame(game, neutral, 0.2)
  assert.equal(rival.distance, fallenAt)
  assert.equal(game.falls, 1)
})

test('a held turn started too early does not trip a rival', () => {
  const game = createGame(41)
  game.enemies = game.enemies.slice(0, 1)
  const [rival] = game.enemies
  rival.distance = -14
  for (let frame = 0; frame < 30; frame++) stepGame(game, { steer: 1, brake: 0 }, tick)
  rival.x = game.x - 1
  rival.distance = game.distance - 2.8
  stepGame(game, { steer: 1, brake: 0 }, tick)
  assert.ok(rival.reachTimer > 0)
  assert.equal(game.falls, 0)
})

test('a distant rival keeps pursuing instead of reaching or falling', () => {
  const game = createGame(41)
  const [rival] = game.enemies
  game.enemies = [rival]
  rival.distance = -12
  for (let frame = 0; frame < 20; frame++) stepGame(game, { steer: 1, brake: 0 }, tick)
  assert.equal(rival.reachTimer, 0)
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

test('repeated reactions to reaching rivals can trip several in a single run', () => {
  const game = createGame(5)
  let turn = 0
  let framesLeft = 0
  while (!game.endReason && game.distance < 600) {
    const center = courseCenter(game.distance)
    const reaching = game.enemies.find((rival) => rival.reachTimer > 0)
    if (framesLeft === 0 && reaching && !game.strongSteer) {
      turn = reaching.reachX >= 0 ? 1 : -1
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
  const state = createGame(11)
  while (!state.endReason && state.distance < 600) {
    const obstacle = state.obstacles.find(
      (item) => item.distance > state.distance - 1.4 && item.distance < state.distance + 21,
    )
    let offset = 0
    if (obstacle) {
      offset = obstacle.x - courseCenter(obstacle.distance)
      if (obstacle.distance - state.distance < 10) offset += offset < 0 ? 2.1 : -2.1
    }
    const target = courseCenter(state.distance) + offset
    stepGame(state, { steer: (target - state.x) * 0.72, brake: 0 }, tick)
  }
  assert.ok(state.distance >= 600)
  assert.ok(state.eliminated >= 3)
})
