import type { GameInput } from './simulation.ts'

export const stickRadius = 43

export function readStick(dx: number, dy: number): GameInput {
  const scale = Math.max(stickRadius, Math.hypot(dx, dy))
  const brakeStart = Math.max(12, Math.abs(dx) * 0.7)
  return {
    steer: dx / scale,
    brake: Math.max(0, Math.min(1, (dy - brakeStart) / (stickRadius - 12))),
  }
}
