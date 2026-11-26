import { RAMP_HALF_WIDTH, RAMP_LENGTH, rampCoordinates, type CourseFeature, type JumpRamp } from './features.ts'
import type { GameEdition } from './edition.ts'

export const COURSE_HALF_WIDTH = 10

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
  nextRow: number
  nextBoost: number
  nextRamp: number
  nextObstacleId: number
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
const firstRamp = 104

export function createCourse(random: () => number, featureRandom: () => number, edition: GameEdition): Course {
  const course: Course = {
    edition,
    obstacles: [],
    features: [],
    nextRow: 49,
    nextBoost: firstBoost,
    nextRamp: firstRamp,
    nextObstacleId: 1,
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
  const { features, featureRandom, obstacles } = course
  while (features.length > 0 && features[0].distance < playerDistance - 20) features.shift()
  // Obstacles are generated farther ahead so we can check each feature's approach.
  while (Math.min(course.nextBoost, course.nextRamp) < playerDistance + 130) {
    const boost = course.nextBoost < course.nextRamp
    const distance = boost ? course.nextBoost : course.nextRamp
    if (boost) course.nextBoost += 76 + featureRandom() * 52
    else course.nextRamp += 218 + featureRandom() * 106

    const offsets = lanes.map((lane) => lane * laneWidth)
    const openingRampOffset = -8.15
    if (distance === firstRamp) offsets.push(openingRampOffset)
    const preferred =
      distance === firstBoost
        ? -5.1
        : distance === firstRamp
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
        break
      }
    }
  }
}
