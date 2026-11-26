import * as THREE from 'three'
import type { GameState } from '../../game/simulation'

const capacity = 55

/** Record the two ski edges over snow so the tracks follow the actual run. */
export function createTracks() {
  const points: { x: number; d: number; lean: number; newTrack?: boolean }[] = []
  const positions = new THREE.BufferAttribute(new Float32Array(capacity * 2 * 6 * 3), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', positions)
  const material = new THREE.MeshBasicMaterial({ color: '#b6cdd9', side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  let previous: GameState | undefined
  let previousDistance = -1
  let airborne = false
  function update(state: GameState) {
    if (state !== previous || state.distance < previousDistance) {
      points.length = 0
      for (let i = 12; i > 0; i--)
        points.push({ x: state.x, d: state.distance - i * 0.48, lean: 0 })
      previous = state
      airborne = false
    }
    previousDistance = state.distance
    const last = points[points.length - 1]
    const gliding = state.glideRemaining > 0
    if (!gliding && (airborne || !last || state.distance - last.d >= 0.44)) {
      points.push({ x: state.x, d: state.distance, lean: state.lean, newTrack: airborne })
      if (points.length > capacity) points.shift()
    }
    airborne = gliding
    let cursor = 0
    for (let i = 0; i < points.length; i++) {
      const start = points[i]
      const end = points[i + 1]
      if (end ? end.newTrack : airborne) continue
      const endX = end ? end.x : state.x
      const endD = end ? end.d : state.distance
      const endLean = end ? end.lean : state.lean
      for (const side of [-1, 1]) {
        const x0 = start.x + side * 0.24 - start.lean * 0.12
        const x1 = endX + side * 0.24 - endLean * 0.12
        const z0 = state.distance - start.d + 0.69
        const z1 = state.distance - endD + 0.69
        const w = 0.035
        positions.setXYZ(cursor++, x0 - w, 0.058, z0)
        positions.setXYZ(cursor++, x0 + w, 0.058, z0)
        positions.setXYZ(cursor++, x1 - w, 0.058, z1)
        positions.setXYZ(cursor++, x1 - w, 0.058, z1)
        positions.setXYZ(cursor++, x0 + w, 0.058, z0)
        positions.setXYZ(cursor++, x1 + w, 0.058, z1)
      }
    }
    positions.needsUpdate = true
    geometry.setDrawRange(0, cursor)
  }
  return { mesh, update }
}
