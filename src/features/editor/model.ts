export type Transform = { x: number; y: number; scaleX: number; scaleY: number; rotation: number }

export type Keyframe = {
  property: 'position' | 'scale' | 'rotation' | 'opacity'
  time: number
  value?: number
  valueX?: number
  valueY?: number
}

export type Clip = {
  id: string
  title: string
  start: number
  duration: number
  color: string
  thumbnail: string
  sourceAssetId?: string
  kind: 'video' | 'audio'
  transform?: Transform
  uniformScale?: boolean
  opacity?: number
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay'
  volume?: number
  fadeIn?: number
  fadeOut?: number
  keyframes?: Keyframe[]
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
  status?: 'catalog-only' | 'ready' | 'missing' | 'processing' | 'error'
}

export type SequenceSettings = { width: number; height: number; frameRate: number }

export type TimelineMarker = { id: string; time: number; label: string }
