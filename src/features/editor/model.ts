export type Clip = {
  id: string
  title: string
  start: number
  duration: number
  color: string
  thumbnail: string
  kind: 'video' | 'audio'
  transform?: { x: number; y: number; scaleX: number; scaleY: number; rotation: number }
  uniformScale?: boolean
  opacity?: number
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay'
  volume?: number
  fadeIn?: number
  fadeOut?: number
  keyframes?: { property: 'position' | 'scale'; time: number }[]
}

export type Track = {
  id: string
  name: string
  kind: 'video' | 'audio'
  clips: Clip[]
}

export type MediaItem = {
  id: string
  title: string
  detail: string
  thumb: string
  type: 'video' | 'audio' | 'image'
  sourcePath?: string
  status?: 'demo' | 'catalog-only' | 'ready' | 'missing' | 'processing' | 'error'
}

export type SequenceSettings = { width: number; height: number; frameRate: number }

export type TimelineMarker = { id: string; time: number; label: string }

export const demoMedia: MediaItem[] = [
  { id: 'media-coastline', title: 'coastline_drone_04.mp4', detail: '4K · 00:24', thumb: 'coast', type: 'video', status: 'demo' },
  { id: 'media-harbor', title: 'harbor_sunrise.mov', detail: '4K · 00:18', thumb: 'harbor', type: 'video', status: 'demo' },
  { id: 'media-drift', title: 'coastal-drift.wav', detail: 'WAV · 02:48', thumb: 'wave', type: 'audio', status: 'demo' },
  { id: 'media-cliffside', title: 'cliffside_walk.mp4', detail: '4K · 00:32', thumb: 'cliff', type: 'video', status: 'demo' },
]

export const demoTracks: Track[] = [
  { id: 'v1', name: 'Video 01', kind: 'video', clips: [
    { id: 'c1', title: 'coastline_drone_04.mp4', start: 0, duration: 7.4, color: 'sand', thumbnail: 'coast', kind: 'video' },
    { id: 'c2', title: 'coastline_drone_04.mp4', start: 7.55, duration: 6.7, color: 'olive', thumbnail: 'cliff', kind: 'video' },
    { id: 'c3', title: 'coastline_drone_04.mp4', start: 14.4, duration: 7.7, color: 'blue', thumbnail: 'sea', kind: 'video' },
  ] },
  { id: 'v2', name: 'Video 02', kind: 'video', clips: [
    { id: 'c4', title: 'coastline_drone_04.mp4', start: 3.1, duration: 4.1, color: 'blue', thumbnail: 'sea', kind: 'video' },
    { id: 'c5', title: 'coastline_drone_04.mp4', start: 10.3, duration: 4.0, color: 'sand', thumbnail: 'coast', kind: 'video' },
  ] },
  { id: 'a1', name: 'Audio 01', kind: 'audio', clips: [
    { id: 'a1c1', title: 'coastal-drift.wav', start: 0, duration: 23, color: 'audio', thumbnail: 'wave', kind: 'audio' },
  ] },
]
