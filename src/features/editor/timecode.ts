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
