import type { GameEdition } from '../game/edition'

interface RunRecords {
  best: number
  runs: number
  eliminated: number
}

export interface Profile {
  name: string
  sound: boolean
  records: Record<GameEdition, RunRecords>
}

const classicKey = 'powder-chase.profile.v1'
const newKey = 'powder-chase.profile.new.v1'

function count(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function readStorage(key: string): Record<string, unknown> {
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? '{}')
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function readRecords(data: Record<string, unknown>): RunRecords {
  return { best: count(data.best), runs: count(data.runs), eliminated: count(data.eliminated) }
}

export function readProfile(): Profile {
  const classic = readStorage(classicKey)
  return {
    name: typeof classic.name === 'string' ? classic.name : '',
    sound: typeof classic.sound === 'boolean' ? classic.sound : true,
    records: { classic: readRecords(classic), new: readRecords(readStorage(newKey)) },
  }
}

export function writeProfile({ name, sound, records }: Profile) {
  try {
    localStorage.setItem(classicKey, JSON.stringify({ name, sound, ...records.classic }))
    localStorage.setItem(newKey, JSON.stringify(records.new))
  } catch {
    /* Session-only play is available. */
  }
}

export function validName(name: string) {
  const normalized = name.normalize('NFC').trim()
  return (
    [...normalized].length <= 16 &&
    /[\p{L}\p{N}\p{S}\p{P}]/u.test(normalized) &&
    !/[\p{Cc}\u202a-\u202e\u2066-\u2069]/u.test(normalized)
  )
}
