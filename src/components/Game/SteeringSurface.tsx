import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { GameInput } from '../../game/simulation'

const stickRadius = 43
const movementKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown', 'KeyA', 'KeyD', 'KeyS'])

interface SteeringProps {
  input: RefObject<GameInput>
  wakeAudio: () => void
}

function readKeys(down: Set<string>, input: GameInput) {
  const left = down.has('ArrowLeft') || down.has('KeyA')
  const right = down.has('ArrowRight') || down.has('KeyD')
  input.steer = Number(right) - Number(left)
  input.brake = Number(down.has('ArrowDown') || down.has('KeyS'))
}

export default function SteeringSurface({ input, wakeAudio }: SteeringProps) {
  const stick = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLSpanElement>(null)
  const touch = useRef<{ id: number; x: number; y: number } | null>(null)
  const keys = useRef(new Set<string>())

  useEffect(() => {
    function updateKeyboard() {
      if (touch.current) return
      readKeys(keys.current, input.current)
    }
    function keyDown(event: KeyboardEvent) {
      if (!movementKeys.has(event.code) || event.altKey || event.ctrlKey || event.metaKey) return
      event.preventDefault()
      if (!event.repeat) wakeAudio()
      keys.current.add(event.code)
      updateKeyboard()
    }
    function keyUp(event: KeyboardEvent) {
      keys.current.delete(event.code)
      updateKeyboard()
    }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      input.current.steer = 0
      input.current.brake = 0
      keys.current.clear()
      touch.current = null
    }
  }, [input, wakeAudio])

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (touch.current || event.button !== 0) return
    wakeAudio()
    event.currentTarget.setPointerCapture(event.pointerId)
    const bounds = event.currentTarget.getBoundingClientRect()
    touch.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    input.current.steer = 0
    input.current.brake = 0
    if (stick.current && knob.current) {
      stick.current.style.left = event.clientX - bounds.left + 'px'
      stick.current.style.top = event.clientY - bounds.top + 'px'
      stick.current.style.opacity = '1'
      knob.current.style.transform = 'translate(0, 0)'
    }
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const origin = touch.current
    if (!origin || event.pointerId !== origin.id) return
    const dx = event.clientX - origin.x
    const dy = event.clientY - origin.y
    const scale = Math.max(stickRadius, Math.hypot(dx, dy))
    input.current.steer = dx / scale
    input.current.brake = Math.max(0, dy / scale)
    if (knob.current) {
      knob.current.style.transform =
        'translate(' + (dx * stickRadius) / scale + 'px, ' + (dy * stickRadius) / scale + 'px)'
    }
  }

  function pointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (touch.current?.id !== event.pointerId) return
    touch.current = null
    if (stick.current) stick.current.style.opacity = '0'
    readKeys(keys.current, input.current)
  }

  return (
    <div
      className="steering-surface"
      aria-label="滑走操作エリア"
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerEnd}
      onPointerCancel={pointerEnd}
      onLostPointerCapture={pointerEnd}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="steering-stick" ref={stick} aria-hidden="true">
        <span className="steering-knob" ref={knob} />
      </div>
    </div>
  )
}
