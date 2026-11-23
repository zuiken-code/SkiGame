import { COURSE_HALF_WIDTH, courseCenter, createCourse, extendCourse } from './course.ts'
import type { Course, Obstacle } from './course.ts'

export { COURSE_HALF_WIDTH, courseCenter }
export type { Obstacle }

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
}

export interface GameState extends Course {
  distance: number
  x: number
  speed: number
  lean: number
  elapsed: number
  slowTimer: number
  eliminated: number
  caught: boolean
  enemies: Enemy[]
  lateralSpeed: number
  nextEnemyId: number
  nextEnemyAt: number
  accumulator: number
}

const tick = 1 / 60
const playerRadius = 0.4
const enemyRadius = 0.42
const edge = COURSE_HALF_WIDTH - playerRadius

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
  })
}

/** Positions are in metres, positive distance is downhill, and time is in seconds. */
export function createGame(seed = Math.floor(Math.random() * 4294967296)): GameState {
  const course = createCourse(seededRandom(seed))
  const state: GameState = {
    ...course,
    distance: 0,
    x: 0,
    speed: 15,
    lean: 0,
    elapsed: 0,
    slowTimer: 0,
    eliminated: 0,
    caught: false,
    enemies: [],
    lateralSpeed: 0,
    nextEnemyId: 1,
    nextEnemyAt: 5 + course.random() * 2.5,
    accumulator: 0,
  }
  addEnemy(state, -7, 1.3)
  return state
}

function hits(x: number, distance: number, radius: number, obstacle: Obstacle): boolean {
  const combined = radius + obstacle.radius
  const dz = distance - obstacle.distance
  if (Math.abs(dz) > combined) return false
  return (x - obstacle.x) ** 2 + dz * dz < combined * combined
}

function movePlayer(state: GameState, input: GameInput, cruise: number) {
  const steer = clamp(input.steer, -1, 1)
  const brake = clamp(input.brake, 0, 1)
  const center = courseCenter(state.distance)
  const edgeDrag = clamp((Math.abs(state.x - center) - (edge - 0.8)) / 0.8, 0, 1)
  const targetSpeed = cruise * (1 - 0.4 * brake - 0.2 * edgeDrag)
  state.slowTimer = Math.max(0, state.slowTimer - tick)
  const recovery = state.slowTimer > 0 ? 1.8 : 5
  state.speed += clamp(targetSpeed - state.speed, -14 * tick, recovery * tick)
  state.distance += state.speed * tick

  const newCenter = courseCenter(state.distance)
  const turnSpeed = 10.6 + state.speed * 0.09
  state.lateralSpeed += (steer * turnSpeed - state.lateralSpeed) * (tick * 8)
  // The skis follow part of the bend. The remaining drift is steered by the player.
  state.x += state.lateralSpeed * tick + (newCenter - center) * 0.46
  state.x = clamp(state.x, newCenter - edge, newCenter + edge)
  state.lean += (steer - state.lean) * (tick * 9)
  for (const obstacle of state.obstacles) {
    if (obstacle.playerHit || !hits(state.x, state.distance, playerRadius, obstacle)) continue
    obstacle.playerHit = true
    state.slowTimer = 1.2
    state.speed = Math.max(5, state.speed * 0.5)
    break
  }
}

function moveEnemies(state: GameState, cruise: number) {
  for (let index = state.enemies.length - 1; index >= 0; index--) {
    const enemy = state.enemies[index]
    const originalCenter = courseCenter(enemy.distance)
    // Once alongside the skier, a rival matches their downhill pace to close sideways.
    enemy.distance = Math.min(
      state.distance + 0.15,
      enemy.distance + (cruise + enemy.chaseBonus) * tick,
    )
    const center = courseCenter(enemy.distance)
    const targetX = state.x - courseCenter(state.distance) + center
    const aim = clamp((targetX - enemy.x) * 1.95, -7.8, 7.8)
    enemy.lateralSpeed += (aim - enemy.lateralSpeed) * (tick * 2.5)
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
    if (
      Math.hypot(enemy.x - state.x, enemy.distance - state.distance) <
      playerRadius + enemyRadius
    ) {
      state.caught = true
      return
    }
  }
}

function advance(state: GameState, input: GameInput) {
  state.elapsed += tick
  const cruise = 15 + 8 * Math.min(1, state.distance / 1500)
  movePlayer(state, input, cruise)
  extendCourse(state, state.distance)
  moveEnemies(state, cruise)
  if (state.caught || state.elapsed < state.nextEnemyAt) return
  const difficulty = Math.min(1, state.distance / 1100)
  state.nextEnemyAt = state.elapsed + 5.1 - difficulty * 2 + state.random() * 3.5
  if (state.enemies.length < 5) {
    const offset = state.x - courseCenter(state.distance) + (state.random() - 0.5) * 6
    addEnemy(state, state.distance - 7.5 - state.random() * 4, offset)
  }
}

/** A fixed tick gives the same physics on 30, 60 and 120 Hz displays. */
export function stepGame(state: GameState, input: GameInput, dt: number): void {
  if (state.caught || !Number.isFinite(dt) || dt <= 0) return
  state.accumulator += Math.min(0.25, dt)
  while (state.accumulator + 1e-10 >= tick && !state.caught) {
    state.accumulator = Math.max(0, state.accumulator - tick)
    advance(state, input)
  }
}
