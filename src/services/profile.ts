export interface Profile {
  name: string
  best: number
  runs: number
  eliminated: number
  sound: boolean
}

const initial: Profile = { name: '', best: 0, runs: 0, eliminated: 0, sound: true }
const key = 'powder-chase.profile.v1'

function count(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

export function readProfile(): Profile {
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? '{}')
    return {
      name: typeof data.name === 'string' ? data.name : '',
      best: count(data.best),
      runs: count(data.runs),
      eliminated: count(data.eliminated),
      sound: typeof data.sound === 'boolean' ? data.sound : true,
    }
  } catch {
    return { ...initial }
  }
}

export function writeProfile(profile: Profile) {
  try {
    localStorage.setItem(key, JSON.stringify(profile))
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
