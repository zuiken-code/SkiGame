export const BOOST_DURATION = 2.6
export const BOOST_SPEED = 8
export const BOOST_PICKUP_RADIUS = 1.2
export const RAMP_HALF_WIDTH = 1.65
export const RAMP_LENGTH = 3.8
export const RAMP_HEIGHT = 0.68
export const GLIDE_DURATION = 20
export const GLIDE_HEIGHT = 10
export const GLIDE_LAUNCH_SPEED_SCALE = 1.95
export const PIGEON_SCALE = 1.6
export const PIGEON_RADIUS = 0.72 * PIGEON_SCALE
export const SKIER_CENTER_HEIGHT = 0.8

interface FeaturePosition {
  x: number
  distance: number
}

export interface JumpRamp extends FeaturePosition {
  kind: 'ramp'
  heading: number
}

export type CourseFeature = (FeaturePosition & { kind: 'boost' }) | JumpRamp

export interface Pigeon extends FeaturePosition {
  id: number
  height: number
}

export function pigeonPosition(pigeon: Pigeon, elapsed: number) {
  const phase = pigeon.id * 2.39996
  return {
    x: pigeon.x + Math.sin(elapsed * 1.85 + phase) * 0.95,
    height: pigeon.height + Math.sin(elapsed * 2.6 + phase) * 0.24,
  }
}

export function rampCoordinates(ramp: JumpRamp, x: number, distance: number) {
  const dx = x - ramp.x
  const downhill = distance - ramp.distance
  const sin = Math.sin(ramp.heading)
  const cos = Math.cos(ramp.heading)
  return { across: dx * cos - downhill * sin, forward: dx * sin + downhill * cos }
}

export function crossesRampLip(
  ramp: JumpRamp,
  previousX: number,
  previousDistance: number,
  x: number,
  distance: number,
) {
  const before = rampCoordinates(ramp, previousX, previousDistance)
  const after = rampCoordinates(ramp, x, distance)
  if (before.forward >= 0 || after.forward < 0) return false

  const fraction = -before.forward / (after.forward - before.forward)
  const across = before.across + (after.across - before.across) * fraction
  return Math.abs(across) <= RAMP_HALF_WIDTH
}

export function smoothstep(value: number) {
  const progress = Math.max(0, Math.min(1, value))
  return progress * progress * (3 - 2 * progress)
}

export function playerHeight(
  glideRemaining: number,
  x: number,
  distance: number,
  features: readonly CourseFeature[],
) {
  if (glideRemaining > 0) {
    const ascent = smoothstep((GLIDE_DURATION - glideRemaining) / 0.55)
    const descent = smoothstep(glideRemaining / 0.8)
    return (RAMP_HEIGHT + (GLIDE_HEIGHT - RAMP_HEIGHT) * ascent) * descent
  }
  for (const feature of features) {
    if (feature.kind !== 'ramp') continue
    const { across, forward } = rampCoordinates(feature, x, distance)
    if (Math.abs(across) <= RAMP_HALF_WIDTH && forward >= -RAMP_LENGTH && forward <= 0)
      return RAMP_HEIGHT * (1 + forward / RAMP_LENGTH)
  }
  return 0
}
