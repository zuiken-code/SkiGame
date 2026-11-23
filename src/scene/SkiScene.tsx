import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { GameState } from '../game/simulation'
import { createWorld } from './environment/world'

export interface SkiSceneProps {
  simulation: { readonly current: GameState }
  paused?: boolean
  preview?: boolean
  onReady?: () => void
  onUnavailable?: () => void
}

class RendererBoundary extends Component<
  { children: ReactNode; onUnavailable?: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onUnavailable?.()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function AlpineWorld({ simulation, preview, onReady, onUnavailable }: SkiSceneProps) {
  const world = useMemo(createWorld, [])
  const ready = useRef(false)
  const renderer = useThree((store) => store.gl)
  const invalidate = useThree((store) => store.invalidate)
  useEffect(() => {
    if (preview) invalidate()
  }, [preview, invalidate])
  useEffect(() => () => world.dispose(), [world])
  useEffect(() => {
    const canvas = renderer.domElement
    function lost(event: Event) {
      event.preventDefault()
      onUnavailable?.()
    }
    canvas.addEventListener('webglcontextlost', lost)
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [renderer, onUnavailable])
  useFrame(({ camera, size }, delta) => {
    world.update(
      simulation.current,
      camera as THREE.PerspectiveCamera,
      size.width / size.height,
      delta,
    )
    if (!ready.current) {
      ready.current = true
      onReady?.()
    }
  })
  return <primitive object={world.group} dispose={null} />
}

/** The UI owns time and input. All world positions are read directly each frame. */
export function SkiScene(props: SkiSceneProps) {
  return (
    <RendererBoundary onUnavailable={props.onUnavailable}>
      <Canvas
        camera={{ near: 0.12, far: 360, fov: 60, position: [0, 6.6, 12.5] }}
        dpr={[1, 1.5]}
        frameloop={props.paused ? 'demand' : 'always'}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.NoToneMapping,
        }}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        aria-label="雪山のスキークロスコース"
      >
        <color attach="background" args={['#d7ecf3']} />
        <fog attach="fog" args={['#d9eaf1', 62, 235]} />
        <ambientLight color="#f5fbff" intensity={0.32} />
        <hemisphereLight args={['#f4fbff', '#bfd1dc', 1.1]} />
        <directionalLight position={[-15, 23, -8]} color="#ffefda" intensity={1.55} />
        <AlpineWorld {...props} />
      </Canvas>
    </RendererBoundary>
  )
}
