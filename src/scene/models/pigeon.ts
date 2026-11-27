import * as THREE from 'three'
import { ModelBuilder } from './geometry'

export function createPigeonBody() {
  const model = new ModelBuilder()
  model.oval([0, 0.01, 0.02], [0.25, 0.22, 0.51], '#768ba1')
  model.oval([0, -0.055, -0.23], [0.23, 0.18, 0.3], '#abbacc')
  model.oval([0, 0.03, 0.48], [0.19, 0.048, 0.25], '#374963', [-0.1, 0, 0])
  model.oval([0, 0.115, -0.32], [0.175, 0.212, 0.19], '#289c91')
  model.oval([0, 0.235, -0.44], [0.152, 0.145, 0.167], '#3f5068')
  model.rod([0, 0.207, -0.55], [0, 0.18, -0.7], 0.056, '#303442', 0.013)
  model.oval([0, 0.22, -0.57], [0.065, 0.036, 0.049], '#eef0e0')
  for (const side of [-1, 1]) {
    model.oval([side * 0.122, 0.272, -0.516], [0.032, 0.036, 0.039], '#f3a64b')
    model.oval([side * 0.139, 0.278, -0.529], [0.018, 0.021, 0.025], '#182641')
  }
  return model.finish()
}

type WingPoint = readonly [span: number, depth: number]

export function createPigeonWing(side: -1 | 1) {
  const model = new ModelBuilder()

  function addPanel(points: readonly WingPoint[], height: number, top: string, underside: string) {
    for (const face of [1, -1]) {
      const shape = new THREE.Shape(
        points.map(([span, depth]) => new THREE.Vector2(span * side, -depth * face)),
      )
      model.add(
        new THREE.ShapeGeometry(shape),
        face === 1 ? top : underside,
        [0, height * face, 0],
        [1, 1, 1],
        [(-Math.PI / 2) * face, 0, 0],
      )
    }
  }

  addPanel(
    [
      [0.08, -0.23],
      [0.4, -0.31],
      [0.73, -0.26],
      [0.91, -0.14],
      [0.98, 0.02],
      [0.91, 0.14],
      [0.77, 0.21],
      [0.55, 0.28],
      [0.31, 0.32],
      [0.08, 0.23],
    ],
    0.016,
    '#405471',
    '#465774',
  )
  addPanel(
    [
      [0.09, -0.23],
      [0.38, -0.29],
      [0.63, -0.24],
      [0.82, -0.13],
      [0.78, 0.02],
      [0.67, 0.15],
      [0.53, 0.23],
      [0.29, 0.28],
      [0.09, 0.205],
    ],
    0.026,
    '#9aabbd',
    '#b8c8d5',
  )
  addPanel(
    [
      [0.12, -0.01],
      [0.45, -0.04],
      [0.8, -0.1],
      [0.78, -0.035],
      [0.45, 0.04],
      [0.12, 0.06],
    ],
    0.034,
    '#3f516a',
    '#4d617b',
  )
  addPanel(
    [
      [0.12, 0.11],
      [0.43, 0.105],
      [0.74, 0.065],
      [0.7, 0.13],
      [0.43, 0.18],
      [0.12, 0.175],
    ],
    0.034,
    '#3f516a',
    '#4d617b',
  )
  return model.finish()
}

export function createPigeonCue() {
  const model = new ModelBuilder()
  const arrow = new THREE.Shape()
  arrow.moveTo(-0.34, 0.15)
  arrow.lineTo(0, -0.05)
  arrow.lineTo(0.34, 0.15)
  arrow.lineTo(0.34, -0.05)
  arrow.lineTo(0, -0.26)
  arrow.lineTo(-0.34, -0.05)
  arrow.closePath()
  model.add(new THREE.ShapeGeometry(arrow), '#492b3b', [0, 0, 0])
  model.add(new THREE.ShapeGeometry(arrow), '#ff9167', [0, -0.015, 0.012], [0.78, 0.69, 1])
  return model.finish()
}
