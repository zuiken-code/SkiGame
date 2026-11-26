import { COURSE_HALF_WIDTH, courseCenter, createCourse, extendCourse } from './course.ts'
import type { Course, Obstacle } from './course.ts'
import type { GameEdition } from './edition.ts'
import {
  BOOST_DURATION,
  BOOST_PICKUP_RADIUS,
  BOOST_SPEED,
  GLIDE_DURATION,
  GLIDE_LAUNCH_SPEED_SCALE,
  LANDING_PROTECTION_DURATION,
  crossesRampLip,
  flightSteeringScale,
} from './features.ts'
import { REACH_RANGE, REACH_TIME, touchesGlove } from './reach.ts'

export { COURSE_HALF_WIDTH, courseCenter }
export type { Obstacle }
export type RunEndReason = 'caught' | 'obstacle'

export interface GameInput {
  steer: number
  brake: number
}

export interface Enemy {
  id: number
  x: number
  distance: number
  lean: number
  lateralSpeed: number
  chaseBonus: number
  fallTimer: number
  fallSide: number
  reachTimer: number
  reachX: number
  reachDownhill: number
}

export interface GameState extends Course {
  distance: number
  x: number
  speed: number
  baseSpeed: number
  boostRemaining: number
  glideRemaining: number
  glideCruiseSpeed: number
  landingProtectionRemaining: number
  lean: number
  elapsed: number
  eliminated: number
  endReason: RunEndReason | null
  enemies: Enemy[]
  lateralSpeed: number
  nextEnemyId: number
  nextEnemyAt: number
  accumulator: number
  strongSteer: number
  dodgeTimer: number
  falls: number
}

const tick = 1 / 60
const playerRadius = 0.34
const enemyRadius = 0.36
const edge = COURSE_HALF_WIDTH - playerRadius
const startSpeed = 21
export const RIVAL_FALL_TIME = 1.8

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}

function seededRandom(seed: number): () => number {
  let bits = seed >>> 0 || 0x9e3779b9
  return () => {
    bits ^= bits << 13
    bits ^= bits >>> 17
    bits ^= bits << 5
    return (bits >>> 0) / 4294967296
  }
}

function addEnemy(state: GameState, distance: number, offset: number) {
  state.enemies.push({
    id: state.nextEnemyId++,
    distance,
    x: courseCenter(distance) + clamp(offset, -edge, edge),
    lean: 0,
    lateralSpeed: 0,
    chaseBonus: 0.52 + state.random() * 0.52,
    fallTimer: 0,
    fallSide: 0,
    reachTimer: 0,
    reachX: 0,
    reachDownhill: 1,
  })
}

/** Positions are in metres, positive distance is downhill, and time is in seconds. */
export function createGame(
  seed = Math.floor(Math.random() * 4294967296),
  edition: GameEdition = 'new',
): GameState {
  const course = createCourse(seededRandom(seed), seededRandom(seed ^ 0x7f4a7c15), edition)
  const state: GameState = {
    ...course,
    distance: 0,
    x: 0,
    speed: startSpeed,
    baseSpeed: startSpeed,
    boostRemaining: 0,
    glideRemaining: 0,
    glideCruiseSpeed: 0,
    landingProtectionRemaining: 0,
    lean: 0,
    elapsed: 0,
    eliminated: 0,
    endReason: null,
    enemies: [],
    lateralSpeed: 0,
    nextEnemyId: 1,
    nextEnemyAt: 5 + course.random() * 2.5,
    accumulator: 0,
    strongSteer: 0,
    dodgeTimer: 0,
    falls: 0,
  }
  addEnemy(state, -6.2, -1.35)
  addEnemy(state, -8.2, 2.5)
  addEnemy(state, -9.8, -3.1)
  return state
}

function hits(x: number, distance: number, radius: number, obstacle: Obstacle): boolean {
  const combined = radius + obstacle.radius
  const dz = distance - obstacle.distance
  if (Math.abs(dz) > combined) return false
  return (x - obstacle.x) ** 2 + dz * dz < combined * combined
}

function useCourseFeatures(state: GameState, previousX: number, previousDistance: number, cruise: number) {
  for (let i = 0; i < state.features.length; i++) {
    const feature = state.features[i]
    if (feature.kind === 'boost') {
      if (
        Math.hypot(state.x - feature.x, state.distance - feature.distance) <= BOOST_PICKUP_RADIUS
      ) {
        state.features.splice(i, 1)
        state.boostRemaining = BOOST_DURATION
        i--
      }
    } else if (crossesRampLip(feature, previousX, previousDistance, state.x, state.distance)) {
      const boost = state.boostRemaining > 0 ? BOOST_SPEED : 0
      const launchBase = Math.min(state.baseSpeed, cruise)
      state.glideCruiseSpeed = launchBase * GLIDE_LAUNCH_SPEED_SCALE + boost
      state.baseSpeed = state.glideCruiseSpeed
      state.glideRemaining = GLIDE_DURATION
      return
    }
  }
}

function downhillSpeed(state: GameState) {
  const boost = state.glideRemaining === 0 && state.boostRemaining > 0 ? BOOST_SPEED : 0
  return state.baseSpeed + boost
}

export function isInvulnerable(state: GameState) {
  return state.glideRemaining > 0 || state.landingProtectionRemaining > 0
}

function movePlayer(state: GameState, input: GameInput, cruise: number) {
  const previousX = state.x
  const previousDistance = state.distance
  const flightBefore = state.glideRemaining
  const wasGliding = flightBefore > 0
  const steer = clamp(input.steer, -1, 1)
  const strongSteer = Math.abs(steer) >= 0.7 ? Math.sign(steer) : 0
  if (strongSteer && strongSteer !== state.strongSteer) state.dodgeTimer = 0.34
  state.strongSteer = strongSteer
  state.dodgeTimer = strongSteer ? Math.max(0, state.dodgeTimer - tick) : 0
  const brake = clamp(input.brake, 0, 1)
  const center = courseCenter(state.distance)
  const brakeScale = 1 - 0.4 * brake
  const targetSpeed = (wasGliding ? state.glideCruiseSpeed : cruise) * brakeScale
  state.baseSpeed += clamp(targetSpeed - state.baseSpeed, -14 * tick, 5 * tick)
  state.speed = downhillSpeed(state)
  state.distance += state.speed * tick

  const newCenter = courseCenter(state.distance)
  state.boostRemaining = Math.max(0, state.boostRemaining - tick)
  state.glideRemaining = state.glideRemaining > tick + 1e-9 ? state.glideRemaining - tick : 0
  if (wasGliding && state.glideRemaining === 0) {
    state.landingProtectionRemaining = LANDING_PROTECTION_DURATION
  } else {
    const remaining = state.landingProtectionRemaining
    state.landingProtectionRemaining = remaining > tick + 1e-9 ? remaining - tick : 0
  }

  const steeringSpeed = wasGliding ? cruise * brakeScale : state.baseSpeed
  const turnSpeed = 10.6 + Math.min(23, steeringSpeed * (23 / 32)) * 0.09
  const turnScale = wasGliding ? flightSteeringScale(flightBefore) : 1
  state.lateralSpeed += (steer * turnSpeed * turnScale - state.lateralSpeed) * (tick * 8)
  // The skier follows part of the bend; the player steers the rest.
  state.x += state.lateralSpeed * tick + (newCenter - center) * 0.46
  state.x = clamp(state.x, newCenter - edge, newCenter + edge)
  state.lean += (steer - state.lean) * (tick * 9)
  if (!wasGliding) useCourseFeatures(state, previousX, previousDistance, cruise)
  state.speed = downhillSpeed(state)
  if (
    !isInvulnerable(state) &&
    state.obstacles.some((obstacle) => hits(state.x, state.distance, playerRadius, obstacle))
  ) {
    state.endReason = 'obstacle'
  }
}

function moveEnemies(
  state: GameState,
  cruise: number,
  playerXBefore: number,
  distanceBefore: number,
) {
  const playerOffset = state.x - courseCenter(state.distance)
  const vulnerable = !isInvulnerable(state)
  for (let index = state.enemies.length - 1; index >= 0; index--) {
    const enemy = state.enemies[index]
    if (enemy.distance < state.distance - 52) {
      state.enemies.splice(index, 1)
      continue
    }
    if (enemy.fallTimer > 0) {
      enemy.fallTimer = Math.max(0, enemy.fallTimer - tick)
      continue
    }
    const originalCenter = courseCenter(enemy.distance)
    const reachX = playerXBefore - enemy.x
    const reachGap = distanceBefore - enemy.distance
    const range = Math.hypot(reachX, reachGap)
    if (vulnerable && enemy.reachTimer === 0 && range > 0.001 && range <= REACH_RANGE) {
      enemy.reachX = reachX / range
      enemy.reachDownhill = reachGap / range
      enemy.reachTimer = REACH_TIME
    }
    const reaching = enemy.reachTimer > 0
    // Once alongside the skier, a rival matches their downhill pace to close sideways.
    enemy.distance = Math.min(
      state.distance + 0.15,
      enemy.distance +
        (cruise + enemy.chaseBonus + (reaching ? 4.4 * Math.max(0, enemy.reachDownhill) : 0)) *
          tick,
    )
    const center = courseCenter(enemy.distance)
    // A rival commits to the grab's direction, even if the skier changes line.
    const aim = reaching
      ? enemy.reachX * 5.6
      : clamp((playerOffset + center - enemy.x) * 1.95, -7.8, 7.8)
    enemy.lateralSpeed += (aim - enemy.lateralSpeed) * (tick * (reaching ? 8 : 2.5))
    enemy.x = clamp(
      enemy.x + enemy.lateralSpeed * tick + center - originalCenter,
      center - edge,
      center + edge,
    )
    enemy.lean = clamp(enemy.lateralSpeed / 7.8, -1, 1)

    if (state.obstacles.some((obstacle) => hits(enemy.x, enemy.distance, enemyRadius, obstacle))) {
      state.enemies.splice(index, 1)
      state.eliminated++
      continue
    }
    if (!reaching) continue
    enemy.reachTimer = Math.max(0, enemy.reachTimer - tick)
    const lateralGap = state.x - enemy.x
    const forwardGap = state.distance - enemy.distance
    if (
      vulnerable &&
      touchesGlove(
        lateralGap,
        forwardGap,
        enemy.reachX,
        enemy.reachDownhill,
        enemy.reachTimer,
        playerRadius,
      )
    ) {
      state.endReason = 'caught'
      return
    }
    const steeringAway =
      enemy.reachX * state.strongSteer >= -0.35 &&
      (state.x - playerXBefore) * state.strongSteer > 1.4 * tick
    const dodged =
      vulnerable &&
      state.dodgeTimer > 0 &&
      steeringAway &&
      Math.hypot(lateralGap, forwardGap) <= REACH_RANGE + 0.5
    if (dodged || enemy.reachTimer === 0) {
      enemy.fallTimer = RIVAL_FALL_TIME
      enemy.fallSide = dodged
        ? state.strongSteer
        : Math.sign(enemy.reachX || enemy.lateralSpeed) || 1
      enemy.reachTimer = 0
      enemy.lateralSpeed = 0
      state.falls++
    }
  }
}

function advance(state: GameState, input: GameInput) {
  state.elapsed += tick
  const cruise = startSpeed + 11 * Math.min(1, state.distance / 1500)
  const playerXBefore = state.x
  const distanceBefore = state.distance
  movePlayer(state, input, cruise)
  if (state.endReason) return
  extendCourse(state, state.distance)
  moveEnemies(state, cruise, playerXBefore, distanceBefore)
  if (state.endReason || state.elapsed < state.nextEnemyAt) return
  const difficulty = Math.min(1, state.distance / 1100)
  state.nextEnemyAt = state.elapsed + 5.1 - difficulty * 2 + state.random() * 3.5
  if (state.enemies.filter((enemy) => enemy.distance > state.distance - 22).length < 6) {
    const offset = state.x - courseCenter(state.distance) + (state.random() - 0.5) * 6
    addEnemy(state, state.distance - 7.5 - state.random() * 4, offset)
  }
}

/** A fixed tick gives the same physics on 30, 60 and 120 Hz displays. */
export function stepGame(state: GameState, input: GameInput, dt: number): void {
  if (state.endReason || !Number.isFinite(dt) || dt <= 0) return
  state.accumulator += Math.min(0.25, dt)
  while (state.accumulator + 1e-10 >= tick && !state.endReason) {
    state.accumulator = Math.max(0, state.accumulator - tick)
    advance(state, input)
  }
}
