export const COURSE_HALF_WIDTH = 7.2

export interface Obstacle {
  id: number
  x: number
  distance: number
  radius: number
  kind: 'rock' | 'pine'
  playerHit: boolean
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
const lanes = [-2, -1, 0, 1, 2]

export interface Course {
  obstacles: Obstacle[]
  nextRow: number
  nextObstacleId: number
  openLane: number
  random: () => number
}

function addObstacle(course: Course, distance: number, offset: number, kind: Obstacle['kind']) {
  course.obstacles.push({
    id: course.nextObstacleId++,
    distance,
    x: courseCenter(distance) + offset,
    radius: kind === 'rock' ? 0.82 + course.random() * 0.25 : 0.72 + course.random() * 0.1,
    kind,
    playerHit: false,
  })
}

export function createCourse(random: () => number): Course {
  const course: Course = { obstacles: [], nextRow: 49, nextObstacleId: 1, openLane: 0, random }
  addObstacle(course, 18, -2.6, 'rock')
  addObstacle(course, 31, 3.2, 'pine')
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
    course.openLane = Math.max(-2, Math.min(2, course.openLane + shift))
    const available = lanes.filter((lane) => lane !== course.openLane)
    const count = random() < 0.22 + difficulty * 0.45 ? 2 : 1
    for (let index = 0; index < count; index++) {
      const [lane] = available.splice(Math.floor(random() * available.length), 1)
      const offset = lane * laneWidth + (random() - 0.5) * 0.48
      addObstacle(course, distance, offset, random() < 0.59 ? 'rock' : 'pine')
    }
    course.nextRow += 16 + (1 - difficulty) * 4 + random() * 9
  }
}
