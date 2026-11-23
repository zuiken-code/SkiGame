import * as THREE from 'three'
import { COURSE_HALF_WIDTH, courseCenter } from '../../game/simulation'
import { noise } from '../models/geometry'

const length = 3.5
const rows = 51
const borders = [
  -18, -12, -9.1, -7.75, -7.14, -6.93, -5.96, -5.92, -3.83, -3.79, -1.52, -1.48, 1.55, 1.59, 3.77,
  3.81, 5.97, 6.01, 6.93, 7.14, 7.75, 9.1, 12, 18,
].map((x) => (x * COURSE_HALF_WIDTH) / 7.2)
const surface = '#eff5f6'
const groove = '#dce9eb'
const swatches = [
  '#e3eff1',
  '#e8f1f4',
  '#d9e7ed',
  '#e2edf0',
  '#bad4df',
  '#dfecef',
  groove,
  surface,
  groove,
  surface,
  groove,
  surface,
  groove,
  surface,
  groove,
  surface,
  groove,
  '#dfecef',
  '#bad4df',
  '#e2edf0',
  '#dae8ed',
  '#e7f1f2',
  '#e3eff1',
].map((value) => new THREE.Color(value))

/** Only the 3.5 m section boundary changes the mesh. Intermediate frames move it. */
export function createPiste() {
  const slices = borders.length - 1
  const positions = new Float32Array(rows * slices * 4 * 3)
  const colors = new Float32Array(positions.length)
  const indices: number[] = []
  let vertex = 0
  for (let row = 0; row < rows; row++) {
    for (let band = 0; band < slices; band++) {
      indices.push(vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3)
      for (let corner = 0; corner < 4; corner++)
        swatches[band].toArray(colors, (vertex + corner) * 3)
      vertex += 4
    }
  }
  const geometry = new THREE.BufferGeometry()
  const position = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', position)
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true }))
  mesh.frustumCulled = false
  let anchor = Number.NaN

  function height(offset: number, index: number) {
    const shoulder = Math.abs(offset) - COURSE_HALF_WIDTH
    if (shoulder < 0) return 0.038
    const bump = Math.sin(Math.max(0, Math.min(1, shoulder / 6)) * Math.PI)
    return 0.038 + bump * (0.39 + noise(index + (offset < 0 ? 210 : 150)) * 0.21)
  }

  function update(distance: number) {
    const section = Math.floor(distance / length) - 6
    if (anchor !== section) {
      anchor = section
      let v = 0
      for (let row = 0; row < rows; row++) {
        const idx = section + row
        const here = courseCenter(idx * length)
        const next = courseCenter((idx + 1) * length)
        for (let band = 0; band < slices; band++) {
          const left = borders[band]
          const right = borders[band + 1]
          position.setXYZ(v++, here + left, height(left, idx), -row * length)
          position.setXYZ(v++, here + right, height(right, idx), -row * length)
          position.setXYZ(v++, next + left, height(left, idx + 1), -(row + 1) * length)
          position.setXYZ(v++, next + right, height(right, idx + 1), -(row + 1) * length)
        }
      }
      position.needsUpdate = true
    }
    mesh.position.z = distance - section * length
  }
  return { mesh, update }
}
