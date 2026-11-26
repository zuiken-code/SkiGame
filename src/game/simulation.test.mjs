import assert from 'node:assert/strict'
import test from 'node:test'
import { COURSE_HALF_WIDTH, courseCenter, createGame, RIVAL_FALL_TIME, stepGame } from './simulation.ts'
import { readStick } from './joystick.ts'
import { extendCourse } from './course.ts'
import {
  BOOST_DURATION,
  BOOST_SPEED,
  GLIDE_DURATION,
  GLIDE_HEIGHT,
  LANDING_PROTECTION_DURATION,
  RAMP_HALF_WIDTH,
  RAMP_HEIGHT,
  RAMP_LENGTH,
  crossesRampLip,
  playerHeight,
} from './features.ts'

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
  assert.deepEqual(fast.features, slow.features)
})

test('a boost is picked up once, adds speed for a fixed time and then expires', () => {
  const game = createGame(17)
  game.enemies = []
  game.obstacles = []
  game.features = [{ kind: 'boost', x: 0, distance: 2 }]
  while (game.boostRemaining === 0 && game.distance < 3) stepGame(game, neutral, tick)
  assert.equal(game.features.length, 0)
  assert.equal(game.boostRemaining, BOOST_DURATION)
  assert.equal(game.speed, game.baseSpeed + BOOST_SPEED)
  for (let frame = 0; frame < 100; frame++) stepGame(game, neutral, tick)
  assert.ok(game.boostRemaining > 0)
  for (let frame = 0; frame < 60; frame++) stepGame(game, neutral, tick)
  assert.equal(game.boostRemaining, 0)
  assert.equal(game.speed, game.baseSpeed)
})

test('a high glide responds to steering and braking while keeping the skier inside the course', () => {
  const rightFlight = createGame(63)
  const leftFlight = createGame(63)
  const neutralFlight = createGame(63)
  for (const state of [rightFlight, leftFlight, neutralFlight]) {
    state.enemies = []
    state.features = [{ kind: 'ramp', x: 0, distance: 5, heading: 0 }]
    state.obstacles = [{ kind: 'rock', x: courseCenter(13), distance: 13, radius: 0.8, id: 1 }]
  }
  while (rightFlight.glideRemaining === 0 && rightFlight.distance < 6) {
    stepGame(rightFlight, neutral, tick)
    stepGame(leftFlight, neutral, tick)
    stepGame(neutralFlight, neutral, tick)
  }
  assert.equal(rightFlight.glideRemaining, GLIDE_DURATION)
  for (let frame = 0; frame < 180; frame++) {
    stepGame(rightFlight, { steer: 1, brake: 0 }, tick)
    stepGame(leftFlight, { steer: -1, brake: 1 }, tick)
    stepGame(neutralFlight, neutral, tick)
    for (const state of [rightFlight, leftFlight, neutralFlight]) {
      assert.ok(Math.abs(state.x - courseCenter(state.distance)) < COURSE_HALF_WIDTH)
      if (frame === 60 || frame === 120) {
        assert.equal(playerHeight(state.glideRemaining, state.x, state.distance, state.features), GLIDE_HEIGHT)
      }
      if (frame === 179) {
        assert.equal(state.endReason, null)
        assert.equal(state.glideRemaining, 0)
        assert.equal(state.speed, state.baseSpeed)
      }
    }
  }
  assert.ok(rightFlight.x - courseCenter(rightFlight.distance) > 9)
  assert.ok(leftFlight.x - courseCenter(leftFlight.distance) < -9)
  assert.equal(rightFlight.distance, neutralFlight.distance)
  assert.ok(leftFlight.distance < rightFlight.distance)
})

test('the jump holds its takeoff speed through landing as steering becomes more precise', () => {
  const takeOff = () => {
    const state = createGame(63)
    state.enemies = []
    state.obstacles = []
    state.nextRow = Infinity
    state.nextEnemyAt = Infinity
    state.boostRemaining = 0.8
    state.features = [{ kind: 'ramp', x: 0, distance: 5, heading: 0 }]
    while (state.glideRemaining === 0 && state.distance < 6) stepGame(state, neutral, tick)
    assert.equal(state.glideRemaining, GLIDE_DURATION)
    assert.ok(state.speed > 45)
    return state
  }

  // Match a centered skier with one making the same small correction in each phase.
  const sample = (elapsedFrames) => {
    const centered = takeOff()
    const steering = takeOff()
    for (let frame = 0; frame < elapsedFrames; frame++) {
      stepGame(centered, neutral, tick)
      stepGame(steering, neutral, tick)
    }
    const before = centered.distance
    for (let frame = 0; frame < 12; frame++) {
      stepGame(centered, neutral, tick)
      stepGame(steering, { steer: 0.5, brake: 0 }, tick)
    }
    return { downhill: centered.distance - before, across: steering.x - centered.x }
  }

  const launch = sample(0)
  const glide = sample(72)
  const landing = sample(168)
  assert.ok(Math.abs(launch.downhill - glide.downhill) < 1e-9)
  assert.ok(Math.abs(glide.downhill - landing.downhill) < 1e-9)
  assert.ok(launch.across > glide.across)
  assert.ok(landing.across > 0 && landing.across < glide.across * 0.7)

  const state = takeOff()
  const takeoffSpeed = state.speed
  for (let frame = 0; frame < 180; frame++) {
    stepGame(state, neutral, tick)
    assert.equal(state.speed, takeoffSpeed)
  }
  assert.equal(state.boostRemaining, 0)
  assert.equal(state.glideRemaining, 0)
  stepGame(state, neutral, tick)
  assert.ok(state.speed < takeoffSpeed && takeoffSpeed - state.speed < 0.3)
})

test('the ramp only launches a skier crossing the rotated lip within its width', () => {
  const ramp = { kind: 'ramp', x: 3, distance: 15, heading: Math.PI / 6 }
  const sin = Math.sin(ramp.heading)
  const cos = Math.cos(ramp.heading)
  const point = (across, forward) => [
    ramp.x + across * cos + forward * sin,
    ramp.distance - across * sin + forward * cos,
  ]
  const inside = RAMP_HALF_WIDTH - 0.1
  const outside = RAMP_HALF_WIDTH + 0.1
  assert.ok(crossesRampLip(ramp, ...point(inside, -0.1), ...point(inside, 0.1)))
  assert.ok(!crossesRampLip(ramp, ...point(outside, -0.1), ...point(outside, 0.1)))
  assert.ok(Math.abs(playerHeight(0, ...point(inside, -RAMP_LENGTH / 2), [ramp]) - RAMP_HEIGHT / 2) < 1e-9)
  assert.equal(playerHeight(0, ...point(outside, -RAMP_LENGTH / 2), [ramp]), 0)
})

test('the opening course offers the boost before the first jump ramp', () => {
  const game = createGame(2)
  const [boost, ramp] = game.features
  assert.equal(boost.kind, 'boost')
  assert.equal(ramp.kind, 'ramp')
  while (game.distance < ramp.distance + 1 && !game.endReason) stepGame(game, neutral, tick)
  assert.equal(game.endReason, null)
  assert.ok(game.glideRemaining > 0 && game.boostRemaining > 0)
  assert.equal(ramp.heading, Math.atan2(courseCenter(ramp.distance) - courseCenter(ramp.distance - RAMP_LENGTH), RAMP_LENGTH))
  assert.ok(!game.features.includes(boost))
})

test('the classic edition keeps the obstacle course without boost pickups or ramps', () => {
  const classic = createGame(2, 'classic')
  const modern = createGame(2, 'new')
  for (let distance = 0; distance <= 700; distance += 20) {
    extendCourse(classic, distance)
    extendCourse(modern, distance)
    assert.deepEqual(classic.features, [])
    assert.deepEqual(classic.obstacles, modern.obstacles)
  }
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

test('obstacle collisions are ignored in flight and for exactly one second after landing', () => {
  const game = createGame(12)
  game.enemies = []
  game.glideRemaining = 2 * tick
  game.glideCruiseSpeed = game.speed
  const obstacle = { kind: 'rock', x: 0, distance: 0, radius: 0.9, id: 1 }
  game.obstacles = [obstacle]
  const collide = () => {
    obstacle.x = game.x
    obstacle.distance = game.distance + game.speed * tick
    stepGame(game, neutral, tick)
  }

  collide()
  assert.ok(game.glideRemaining > 0)
  assert.equal(game.endReason, null)
  collide()
  assert.equal(game.glideRemaining, 0)
  assert.equal(game.landingProtectionRemaining, LANDING_PROTECTION_DURATION)
  assert.equal(game.endReason, null)
  for (let frame = 0; frame < 59; frame++) collide()
  assert.ok(game.landingProtectionRemaining > 0)
  assert.equal(game.endReason, null)
  collide()
  assert.equal(game.landingProtectionRemaining, 0)
  assert.equal(game.endReason, 'obstacle')
})

test('a committed grab cannot catch the skier until landing protection ends', () => {
  const game = createGame(7)
  const [rival] = game.enemies
  game.enemies = [rival]
  game.landingProtectionRemaining = 2 * tick
  rival.reachTimer = 0.6
  rival.reachX = 0
  rival.reachDownhill = 1
  const overlapGloves = () => {
    rival.x = game.x
    rival.distance = game.distance - 1
    stepGame(game, neutral, tick)
  }

  overlapGloves()
  assert.equal(game.endReason, null)
  assert.ok(rival.reachTimer > 0)
  overlapGloves()
  assert.equal(game.endReason, 'caught')
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
  game.features = []
  game.nextBoost = game.nextRamp = Infinity
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
  state.features = []
  state.nextBoost = state.nextRamp = Infinity
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
