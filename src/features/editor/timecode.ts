export function secondsToFrameNumber(seconds: number, frameRate: number) {
  const fps = Math.max(1, Math.round(frameRate))
  return Math.max(0, Math.floor(seconds * fps + 1e-7))
}

export function formatTimecode(seconds: number, frameRate: number) {
  const fps = Math.max(1, Math.round(frameRate))
  const frames = secondsToFrameNumber(seconds, fps)
  const frame = frames % fps
  const totalSeconds = Math.floor(frames / fps)
  const second = totalSeconds % 60
  const minute = Math.floor(totalSeconds / 60) % 60
  const hour = Math.floor(totalSeconds / 3600)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}:${String(frame).padStart(2, '0')}`
}

export function formatRulerTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`
}

/**
 * Parses a user-typed timecode into seconds.
 * Accepts `HH:MM:SS:FF`, `MM:SS:FF`, `MM:SS`, `SS` and decimal seconds (`12.5`).
 * Returns `null` when the input cannot be parsed.
 */
export function parseTimecode(input: string, frameRate: number): number | null {
  const fps = Math.max(1, Math.round(frameRate))
  const raw = input.trim().replace(/[;.](?=\d{1,2}$)/, ':')
  if (!raw) return null
  if (/^\d+(\.\d+)?$/.test(input.trim())) {
    const value = Number(input.trim())
    return Number.isFinite(value) ? Math.max(0, value) : null
  }
  const parts = raw.split(':')
  if (parts.length < 2 || parts.length > 4 || parts.some((part) => !/^\d+$/.test(part))) return null
  const nums = parts.map(Number)
  let hours = 0
  let minutes: number
  let seconds: number
  let frames = 0
  if (nums.length === 4) {
    ;[hours, minutes, seconds, frames] = nums
  } else if (nums.length === 3) {
    ;[minutes, seconds, frames] = nums
  } else {
    ;[minutes, seconds] = nums
  }
  if (frames >= fps || seconds >= 60 || minutes >= 60) return null
  return hours * 3600 + minutes * 60 + seconds + frames / fps
}
