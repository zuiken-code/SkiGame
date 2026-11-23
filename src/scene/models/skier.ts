import { ModelBuilder } from './geometry'
import { HAND_FORWARD, HAND_RADIUS, HAND_SPREAD } from '../../game/reach'

/** The downhill tuck leaves the helmet, shoulder line, bib and skis readable from behind. */
export function createSkier(rival = false, part: 'full' | 'skis' | 'torso' = 'full') {
  const model = new ModelBuilder()
  const shell = rival ? '#284675' : '#fb582e'
  const darkShell = rival ? '#193354' : '#c93c26'
  const stripe = rival ? '#a7d6f2' : '#ffbe69'
  const pants = rival ? '#273149' : '#253a4c'
  const helmet = rival ? '#414c75' : '#ffefe0'
  const ski = rival ? '#ffb45c' : '#1b6576'

  for (const side of [-1, 1]) {
    if (part === 'torso') break
    const x = 0.23 * side
    model.box([x, 0.08, 0.01], [0.14, 0.07, 1.93], ski, [0, -side * 0.045, 0])
    model.box([x + side * 0.04, 0.15, -0.99], [0.14, 0.07, 0.22], ski, [0.42, 0, 0])
    model.box([x, 0.12, 0.56], [0.112, 0.015, 0.33], stripe)
    model.box([x, 0.21, 0.03], [0.21, 0.21, 0.39], '#263545')
    model.box([x, 0.3, -0.015], [0.215, 0.088, 0.23], '#e0e9eb')
    model.rod([x, 0.32, 0.025], [x, 0.62, -0.18], 0.112, pants, 0.13)
    model.rod([x, 0.62, -0.18], [side * 0.155, 0.91, 0.17], 0.135, pants, 0.145)
  }
  if (part === 'skis') return model.finish()

  model.oval([0, 1.13, 0.06], [0.34, 0.42, 0.25], shell, [-0.34, 0, 0])
  model.oval([0, 0.92, 0.155], [0.3, 0.15, 0.205], darkShell)
  model.box([0, 1.24, 0.243], [0.32, 0.26, 0.055], stripe, [-0.37, 0, 0])
  model.box([0.055, 1.25, 0.275], [0.055, 0.16, 0.022], darkShell, [-0.37, 0, 0])
  model.box([-0.027, 1.26, 0.275], [0.055, 0.14, 0.023], darkShell, [-0.37, 0, 0])

  for (const side of [-1, 1]) {
    if (part === 'torso') break
    model.rod([side * 0.245, 1.38, -0.055], [side * 0.43, 1.14, 0.08], 0.118, shell, 0.108)
    model.rod([side * 0.43, 1.14, 0.08], [side * 0.51, 1.045, -0.22], 0.1, darkShell, 0.078)
    model.oval([side * 0.51, 1.045, -0.23], [0.086, 0.09, 0.107], pants)
    model.rod([side * 0.51, 1.055, -0.23], [side * 0.76, 0.1, 0.83], 0.022, '#45677c', 0.015)
    model.oval([side * 0.744, 0.17, 0.76], [0.068, 0.022, 0.068], '#263d4c')
  }

  model.oval([0, 1.5, -0.08], [0.15, 0.14, 0.145], '#283649')
  model.oval([0, 1.69, -0.155], [0.237, 0.25, 0.224], helmet)
  model.oval([0, 1.66, -0.155], [0.24, 0.071, 0.228], '#354753')
  model.oval([0, 1.69, -0.31], [0.204, 0.089, 0.105], rival ? '#ffae66' : '#69c5df')
  model.oval([0, 1.775, -0.143], [0.042, 0.16, 0.214], rival ? '#8597cb' : shell)
  return model.finish()
}

/** Both arms share the torso's yaw and extend along its local forward axis. */
export function createReachArms() {
  const model = new ModelBuilder()
  for (const side of [-1, 1]) {
    const shoulder: [number, number, number] = [side * 0.245, 1.38, -0.045]
    const elbow: [number, number, number] = [side * 0.4, 1.34, -0.67]
    const hand: [number, number, number] = [side * HAND_SPREAD, 1.39, -HAND_FORWARD]
    model.rod(shoulder, elbow, 0.122, '#284675', 0.097)
    model.rod(elbow, hand, 0.104, '#4f78a1', 0.095)
    model.oval(hand, [HAND_RADIUS, 0.102, HAND_RADIUS], '#ffb554')
  }
  return model.finish()
}
