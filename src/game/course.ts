import {
  BOOST_SPEED,
  GLIDE_DURATION,
  GLIDE_HEIGHT,
  GLIDE_LAUNCH_SPEED_SCALE,
  RAMP_HALF_WIDTH,
  RAMP_LENGTH,
  SKIER_CENTER_HEIGHT,
  rampCoordinates,
  type CourseFeature,
  type JumpRamp,
  type Pigeon,
} from './features.ts'
import type { GameEdition } from './edition.ts'

export const COURSE_HALF_WIDTH = 10
export const MAX_GROUND_SPEED = 32

export interface Obstacle {
  id: number
  x: number
  distance: number
  radius: number
  kind: 'rock' | 'pine'
}

/** World X at a given downhill distance. Both rendering and physics sample this curve. */
export function courseCenter(distance: number): number {
  return (
    13 * (1 - Math.cos(distance / 53)) -
    11 * (1 - Math.cos(distance / 97)) +
    4 * (1 - Math.cos(distance / 31))
  )
}

const laneWidth = 2.55
const lanes = [-3, -2, -1, 0, 1, 2, 3]
function rampFitsCourse(ramp: JumpRamp, obstacles: readonly Obstacle[]) {
  const sin = Math.sin(ramp.heading)
  const cos = Math.cos(ramp.heading)
  for (const forward of [-RAMP_LENGTH, -RAMP_LENGTH / 2, 0]) {
    for (const across of [-RAMP_HALF_WIDTH, RAMP_HALF_WIDTH]) {
      const x = ramp.x + forward * sin + across * cos
      const distance = ramp.distance + forward * cos - across * sin
      if (Math.abs(x - courseCenter(distance)) > COURSE_HALF_WIDTH) return false
    }
  }

  return obstacles.every((obstacle) => {
    const { across, forward } = rampCoordinates(ramp, obstacle.x, obstacle.distance)
    const clearance = obstacle.radius + 1
    return (
      Math.abs(across) > RAMP_HALF_WIDTH + clearance ||
      forward < -RAMP_LENGTH - clearance ||
      forward > clearance
    )
  })
}

export interface Course {
  edition: GameEdition
  obstacles: Obstacle[]
  features: CourseFeature[]
  pigeons: Pigeon[]
  nextRow: number
  nextBoost: number
  nextRamp: number
  nextObstacleId: number
  nextPigeonId: number
  openLane: number
  random: () => number
  featureRandom: () => number
}

function addObstacle(course: Course, distance: number, offset: number, kind: Obstacle['kind']) {
  course.obstacles.push({
    id: course.nextObstacleId++,
    distance,
    x: courseCenter(distance) + offset,
    radius: kind === 'rock' ? 0.82 + course.random() * 0.25 : 0.72 + course.random() * 0.1,
    kind,
  })
}

const firstBoost = 55
export const FIRST_RAMP_DISTANCE = 210
export const RAMP_MIN_GAP = 2250
export const RAMP_MAX_GAP = 3200

export function createCourse(random: () => number, featureRandom: () => number, edition: GameEdition): Course {
  const course: Course = {
    edition,
    obstacles: [],
    features: [],
    pigeons: [],
    nextRow: 49,
    nextBoost: firstBoost,
    nextRamp: FIRST_RAMP_DISTANCE,
    nextObstacleId: 1,
    nextPigeonId: 1,
    openLane: 0,
    random,
    featureRandom,
  }
  addObstacle(course, 23, -2.6, 'rock')
  addObstacle(course, 39, 3.2, 'pine')
  extendCourse(course, 0)
  return course
}

/** Keep one clear lane through every row, shifting it by at most one lane per row. */
export function extendCourse(course: Course, playerDistance: number) {
  const { random, obstacles } = course
  while (obstacles.length > 0 && obstacles[0].distance < playerDistance - 22) {
    obstacles.shift()
  }
  while (course.nextRow < playerDistance + 160) {
    const distance = course.nextRow
    const difficulty = Math.min(1, distance / 1100)
    const shift = Math.floor(random() * 3) - 1
    course.openLane = Math.max(lanes[0], Math.min(lanes[lanes.length - 1], course.openLane + shift))
    const available = lanes.filter((lane) => lane !== course.openLane)
    const count = random() < 0.22 + difficulty * 0.45 ? 2 : 1
    for (let index = 0; index < count; index++) {
      const [lane] = available.splice(Math.floor(random() * available.length), 1)
      const offset = lane * laneWidth + (random() - 0.5) * 0.48
      addObstacle(course, distance, offset, random() < 0.59 ? 'rock' : 'pine')
    }
    course.nextRow += 20 + (1 - difficulty) * 6 + random() * 10
  }
  if (course.edition === 'new') extendFeatures(course, playerDistance)
}

function extendFeatures(course: Course, playerDistance: number) {
  const { features, featureRandom, obstacles, pigeons } = course
  while (features.length > 0 && features[0].distance < playerDistance - 20) features.shift()
  while (pigeons.length > 0 && pigeons[0].distance < playerDistance - 20) pigeons.shift()
  // Obstacles are generated farther ahead so we can check each feature's approach.
  while (Math.min(course.nextBoost, course.nextRamp) < playerDistance + 130) {
    const boost = course.nextBoost < course.nextRamp
    const distance = boost ? course.nextBoost : course.nextRamp
    if (boost) course.nextBoost += 76 + featureRandom() * 52
    else course.nextRamp += RAMP_MIN_GAP + featureRandom() * (RAMP_MAX_GAP - RAMP_MIN_GAP)

    const offsets = lanes.map((lane) => lane * laneWidth)
    const openingRampOffset = -1.5
    if (distance === FIRST_RAMP_DISTANCE) offsets.push(openingRampOffset)
    const preferred =
      distance === firstBoost
        ? -5.1
        : distance === FIRST_RAMP_DISTANCE
          ? openingRampOffset
          : offsets[Math.floor(featureRandom() * offsets.length)]
    offsets.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred))
    const center = courseCenter(distance)
    if (boost) {
      const x = offsets.map((offset) => center + offset).find((position) =>
        obstacles.every((obstacle) =>
          Math.abs(obstacle.distance - distance) > 3.5 ||
          Math.abs(position - obstacle.x) > obstacle.radius + 1.25,
        ),
      )
      if (x !== undefined) features.push({ kind: 'boost', x, distance })
      continue
    }

    const heading = Math.atan2(center - courseCenter(distance - RAMP_LENGTH), RAMP_LENGTH)
    for (const offset of offsets) {
      const ramp: JumpRamp = { kind: 'ramp', x: center + offset, distance, heading }
      if (rampFitsCourse(ramp, obstacles)) {
        features.push(ramp)
        addPigeonFlocks(course, ramp)
        break
      }
    }
  }
}

function addPigeonFlocks(course: Course, ramp: JumpRamp) {
  const { featureRandom, pigeons } = course
  const flightReach = GLIDE_DURATION * (MAX_GROUND_SPEED * GLIDE_LAUNCH_SPEED_SCALE + BOOST_SPEED)
  // Leave takeoff clear and cover the full route even at maximum launch speed.
  for (let gap = 65; gap < flightReach; gap += 66 + featureRandom() * 19) {
    const distance = ramp.distance + gap
    const offsets = [-8.7, -4.25, 0, 4.25, 8.7]
    const count = ramp.distance > FIRST_RAMP_DISTANCE && featureRandom() < 0.55 ? 3 : 2
    for (let index = 0; index < count; index++) {
      const [offset] = offsets.splice(Math.floor(featureRandom() * offsets.length), 1)
      pigeons.push({
        id: course.nextPigeonId++,
        x: courseCenter(distance) + offset,
        distance,
        height: GLIDE_HEIGHT + SKIER_CENTER_HEIGHT + (featureRandom() - 0.5) * 0.7,
      })
    }
  }
}
