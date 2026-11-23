// Model-space hand positions. The renderer and capture test use the same reach.
export const RIVAL_SCALE = 0.76
export const HAND_SPREAD = 0.43
export const HAND_FORWARD = 1.42
export const HAND_RADIUS = 0.14
export const REACH_RANGE = 3.75
export const REACH_TIME = 1.12

export function armExtension(timeLeft: number) {
  return 0.42 + 0.58 * Math.min(1, Math.max(0, (REACH_TIME - timeLeft) / 0.18))
}

/** Compare each glove with the skier in the rival's local horizontal plane. */
export function touchesGlove(
  dx: number,
  downhillGap: number,
  aimX: number,
  aimDownhill: number,
  timeLeft: number,
  playerRadius: number,
) {
  const forward = dx * aimX + downhillGap * aimDownhill
  const across = dx * aimDownhill - downhillGap * aimX
  const handPlane = HAND_FORWARD * RIVAL_SCALE * armExtension(timeLeft)
  const handGap = Math.abs(across) - HAND_SPREAD * RIVAL_SCALE
  return (
    (forward - handPlane) ** 2 + handGap ** 2 <= (playerRadius + HAND_RADIUS * RIVAL_SCALE) ** 2
  )
}
