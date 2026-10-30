import type { EffectInstance, TransitionRef } from './effects/catalog'
export type { EffectDef, EffectInstance, EffectKind, EffectParamDef, TransitionRef } from './effects/catalog'

export type Transform = { x: number; y: number; scaleX: number; scaleY: number; rotation: number }

export type Keyframe = {
  property: 'position' | 'scale' | 'rotation' | 'opacity'
  time: number
  value?: number
  valueX?: number
  valueY?: number
}

export type TextAnimationIn =
  | 'none'
  | 'pop'
  | 'fade-up'
  | 'typewriter'
  | 'karaoke'
  | 'slide-left'
  | 'bounce'
  | 'glitch'
  | 'zoom-in'

export type TextAnimationOut = 'none' | 'fade-out' | 'pop-out' | 'slide-down'

export type TextAnimationLoop = 'none' | 'pulse' | 'float' | 'neon-flicker'

export type TextStyle = {
  presetId: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
  accentColor: string
  strokeColor: string
  strokeWidth: number
  backgroundColor: string
  backgroundOpacity: number
  backgroundRadius: number
  shadowColor: string
  shadowBlur: number
  align: 'left' | 'center' | 'right'
  positionY: number
  uppercase: boolean
  italic: boolean
  letterSpacing: number
}

export type TextAnimation = {
  in: TextAnimationIn
  out: TextAnimationOut
  loop: TextAnimationLoop
  inDuration: number
  outDuration: number
}

export type FitMode = 'fit' | 'fill' | 'stretch'

export type ClipBlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'soft-light'
  | 'add'

export type ClipCrop = {
  l: number
  t: number
  r: number
  b: number
}

export type Clip = {
  id: string
  title: string
  start: number
  duration: number
  color: string
  thumbnail: string
  sourceAssetId?: string
  kind: 'video' | 'audio' | 'adjustment'
  transform?: Transform
  uniformScale?: boolean
  opacity?: number
  blendMode?: ClipBlendMode
  fit?: FitMode
  crop?: ClipCrop
  flipH?: boolean
  flipV?: boolean
  speed?: number
  preservePitch?: boolean
  freezeTime?: number
  effects?: EffectInstance[]
  transitionIn?: TransitionRef
  transitionOut?: TransitionRef
  volume?: number
  fadeIn?: number
  fadeOut?: number
  keyframes?: Keyframe[]
  text?: string
  textStyle?: TextStyle
  textAnimation?: TextAnimation
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
  durationSeconds?: number
  sourcePath?: string
  status?: 'catalog-only' | 'ready' | 'missing' | 'processing' | 'error'
  width?: number
  height?: number
}

export type SequenceSettings = { width: number; height: number; frameRate: number }

export type TimelineMarker = { id: string; time: number; label: string }
