import { useCallback, useEffect, useRef } from 'react'

const tones = {
  impact: [150, 65, 0.14],
  escape: [440, 740, 0.14],
  finish: [280, 80, 0.32],
} as const

export function useGameSound(enabled: boolean) {
  const device = useRef<AudioContext | null>(null)
  const wake = useCallback(() => {
    if (!enabled) return
    try {
      const Audio =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Audio) return
      const context = (device.current ??= new Audio())
      if (context.state === 'suspended') void context.resume().catch(() => {})
    } catch {
      // The run remains playable when device audio is unavailable.
    }
  }, [enabled])

  const play = useCallback(
    (effect: keyof typeof tones) => {
      const context = device.current
      if (!enabled || !context || context.state !== 'running') return
      const tone = context.createOscillator()
      const volume = context.createGain()
      const start = context.currentTime
      const [from, to, duration] = tones[effect]
      tone.type = effect === 'impact' ? 'triangle' : 'sine'
      tone.frequency.setValueAtTime(from, start)
      tone.frequency.exponentialRampToValueAtTime(to, start + duration)
      volume.gain.setValueAtTime(0.001, start)
      volume.gain.exponentialRampToValueAtTime(0.065, start + 0.012)
      volume.gain.exponentialRampToValueAtTime(0.001, start + duration)
      tone.connect(volume).connect(context.destination)
      tone.start(start)
      tone.stop(start + duration)
      tone.onended = () => {
        tone.disconnect()
        volume.disconnect()
      }
    },
    [enabled],
  )

  useEffect(
    () => () => {
      const context = device.current
      device.current = null
      if (context && context.state !== 'closed') void context.close().catch(() => {})
    },
    [],
  )
  return { wake, play }
}
