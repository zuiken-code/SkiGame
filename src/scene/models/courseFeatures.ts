import * as THREE from 'three'
import { RAMP_HALF_WIDTH, RAMP_HEIGHT, RAMP_LENGTH } from '../../game/features'
import { ModelBuilder } from './geometry'

export function createBoostToken() {
  const model = new ModelBuilder()
  const faceRotation: [number, number, number] = [Math.PI / 2, 0, 0]
  model.add(
    new THREE.CylinderGeometry(0.87, 0.87, 0.24, 10),
    '#c87714',
    [0, 0, 0],
    [1, 1, 1],
    faceRotation,
  )
  model.add(
    new THREE.CylinderGeometry(0.75, 0.75, 0.27, 10),
    '#ffcc40',
    [0, 0, 0],
    [1, 1, 1],
    faceRotation,
  )
  const bolt = new THREE.Shape()
  bolt.moveTo(0.12, 0.58)
  bolt.lineTo(-0.33, -0.04)
  bolt.lineTo(-0.04, -0.04)
  bolt.lineTo(-0.16, -0.56)
  bolt.lineTo(0.35, 0.12)
  bolt.lineTo(0.05, 0.12)
  bolt.closePath()
  model.add(new THREE.ShapeGeometry(bolt), '#fffbed', [0, 0, 0.14])
  model.add(new THREE.ShapeGeometry(bolt), '#fffbed', [0, 0, -0.14], [1, 1, 1], [0, Math.PI, 0])
  return model.finish()
}

export function createJumpRamp() {
  const model = new ModelBuilder()
  const w = RAMP_HALF_WIDTH
  const h = RAMP_HEIGHT
  const l = RAMP_LENGTH
  const top = new THREE.BufferGeometry()
  top.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-w, h, 0, -w, 0, l, w, h, 0, w, h, 0, -w, 0, l, w, 0, l], 3),
  )
  model.add(top, '#25b4ca', [0, 0, 0])
  const sides = new THREE.BufferGeometry()
  sides.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -w,
        h,
        0,
        w,
        h,
        0,
        -w,
        0,
        0,
        w,
        h,
        0,
        w,
        0,
        0,
        -w,
        0,
        0,
        -w,
        0,
        l,
        -w,
        h,
        0,
        -w,
        0,
        0,
        w,
        0,
        l,
        w,
        0,
        0,
        w,
        h,
        0,
      ],
      3,
    ),
  )
  model.add(sides, '#22687f', [0, 0, 0])
  const slope = Math.atan2(h, l)
  for (const side of [-1, 1]) {
    model.box(
      [side * (w - 0.12), h / 2 + 0.025, l / 2],
      [0.15, 0.06, Math.hypot(h, l)],
      '#ffca53',
      [slope, 0, 0],
    )
  }
  for (const z of [0.9, 2.25]) {
    const tipY = h * (1 - z / l) + 0.035
    const tailY = h * (1 - (z + 0.64) / l) + 0.035
    for (const side of [-1, 1]) {
      model.rod([side * 0.62, tailY, z + 0.64], [0, tipY, z], 0.086, '#f7feff')
    }
  }
  return model.finish()
}
