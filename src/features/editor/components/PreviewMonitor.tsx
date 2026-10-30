import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Copy, Expand, Film, LoaderCircle, Monitor, Pause, Pencil, Play, SkipBack, SkipForward, Smartphone, Trash2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ActionMenu } from './ActionMenu'
import type { Clip, EffectInstance, MediaItem, TimelineMarker } from '../model'
import { formatTimecode, parseTimecode } from '../timecode'
import { t } from '../services/locale'
import { loadMediaSource } from '../services/media-storage'
import { getInterpolatedOpacity, getInterpolatedTransform } from '../services/keyframe-interpolation'
import { computeTextAnimationState, getDefaultTextStyle } from '../services/text-presets'
import { useEditorStore } from '../editor-store'
import { toast } from '../../../components/ui/toast-service'
import { computeTransitionInState } from '../effects/transition-math'
import { getEffectsCSSFilter } from '../effects/pixel-effects'

type Props = {
  playhead: number
  frameRate: number
  duration: number
  clip?: Clip
  visualClips?: PreviewVisualClip[]
  adjustmentLayers?: PreviewVisualClip[]
  textOverlays?: Clip[]
  selectedClipId?: string
  media?: MediaItem
  assets?: MediaItem[]
  markers: TimelineMarker[]
  sequenceSize?: { width: number; height: number }
  onSetSequence?: (sequence: { width: number; height: number; frameRate: number }) => void
  onDuplicateClip?: (clipId: string) => void
  onDeleteClip?: (clipId: string) => void
  playing: boolean
  onSeek: (time: number) => void
  onTogglePlay: () => void
  onSelectClip?: (clipId: string) => void
  onUpdateClip?: (clipId: string, changes: Partial<Clip>) => void
  isMuted?: boolean
  volume?: number
}
type ZoomPreset = 'fit' | '50%' | '100%' | '200%'
type PreviewVisualClip = Clip & { trackId: string; trackOrder: number }

function hexToRgbaCss(hex: string, alphaPercent: number): string {
  const clean = hex.replace('#', '').trim()
  const alpha = Math.max(0, Math.min(1, alphaPercent / 100))
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0
    const g = parseInt(clean[1] + clean[1], 16) || 0
    const b = parseInt(clean[2] + clean[2], 16) || 0
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  const r = parseInt(clean.slice(0, 2), 16) || 0
  const g = parseInt(clean.slice(2, 4), 16) || 0
  const b = parseInt(clean.slice(4, 6), 16) || 0
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

type PreviewEffectOverlay = { id: string; opacity: number; blend: React.CSSProperties['mixBlendMode']; image: string; size?: string }

function getPreviewEffectOverlays(effects?: EffectInstance[]): PreviewEffectOverlay[] {
  const overlays: PreviewEffectOverlay[] = []
  for (const effect of (effects ?? []).filter((item) => item.enabled)) {
    const strength = Math.max(0, Math.min(1, (effect.intensity ?? 100) / 100))
    if (effect.effectId === 'fx-film-grain') overlays.push({ id: effect.id, opacity: ((effect.params.amount ?? 35) / 100) * strength * 0.34, blend: 'soft-light', image: 'url("data:image/svg+xml,%3Csvg viewBox=%270 0 180 180%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%27.82%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27 opacity=%27.8%27/%3E%3C/svg%3E")' })
    if (effect.effectId === 'fx-halftone') overlays.push({ id: effect.id, opacity: 0.52 * strength, blend: 'multiply', image: 'radial-gradient(rgba(0,0,0,.72) .75px, transparent .9px)', size: `${Math.max(3, effect.params.dotSize ?? 8)}px ${Math.max(3, effect.params.dotSize ?? 8)}px` })
    if (effect.effectId === 'fx-vhs-glitch') overlays.push({ id: effect.id, opacity: 0.28 * strength, blend: 'screen', image: 'repeating-linear-gradient(0deg, transparent 0 5px, rgba(255,255,255,.42) 6px, transparent 7px), linear-gradient(90deg, rgba(255,30,90,.35), transparent 22%, transparent 78%, rgba(35,180,255,.38))' })
    if (effect.effectId === 'fx-chromatic-aberration') overlays.push({ id: effect.id, opacity: 0.2 * strength, blend: 'screen', image: 'linear-gradient(90deg, rgba(255,20,70,.72), transparent 18%, transparent 82%, rgba(20,190,255,.75))' })
  }
  return overlays
}

export function PreviewMonitor({
  playhead,
  frameRate,
  duration,
  clip,
  visualClips = [],
  adjustmentLayers = [],
  textOverlays = [],
  selectedClipId,
  media,
  assets,
  markers,
  sequenceSize = { width: 1920, height: 1080 },
  onSetSequence,
  onDuplicateClip,
  onDeleteClip,
  playing,
  onSeek,
  onTogglePlay,
  onSelectClip,
  onUpdateClip,
  isMuted = false,
  volume = 1,
}: Props) {
  const [safeMargins] = useState(false)
  const [thirds] = useState(false)
  const [zoom, setZoom] = useState<ZoomPreset>('fit')
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [hoverScrub, setHoverScrub] = useState<{ time: number; ratio: number } | null>(null)
  const [timecodeDraft, setTimecodeDraft] = useState<string | null>(null)
  const [sourceState, setSourceState] = useState<{ assetId: string; status: 'ready' | 'missing'; url?: string } | null>(null)
  const [layerSources, setLayerSources] = useState<Record<string, { assetId: string; url: string | null }>>({})
  const [snapGuides, setSnapGuides] = useState<{ x: boolean; y: number | null }>({ x: false, y: null })
  const [detectedVideoFormat, setDetectedVideoFormat] = useState<{ width: number; height: number; isVertical: boolean } | null>(null)
  const [inlineEditingClipId, setInlineEditingClipId] = useState<string | null>(null)
  const [inlineEditText, setInlineEditText] = useState('')
  const inlineInputRef = useRef<HTMLTextAreaElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasBoxRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const layerVideoRefs = useRef(new Map<string, HTMLVideoElement>())
  const layerSourcesRef = useRef<Record<string, { assetId: string; url: string | null }>>({})
  const timecode = formatTimecode(playhead, frameRate)
  const transform = clip
    ? getInterpolatedTransform(clip, playhead, sequenceSize)
    : { x: sequenceSize.width / 2, y: sequenceSize.height / 2, scaleX: 100, scaleY: 100, rotation: 0 }
  const clipOpacity = clip ? getInterpolatedOpacity(clip, playhead) / 100 : 1
  const isTextOnlyPrimary = !!clip && (clip.text !== undefined || clip.thumbnail === 'text-overlay')
  const sourceAssetId = !isTextOnlyPrimary ? (clip?.sourceAssetId ?? media?.id) : undefined
  const previewTitle = clip?.title ?? textOverlays[0]?.title ?? media?.title
  const isImage = clip && !isTextOnlyPrimary ? clip.thumbnail === 'image-catalog' : media?.type === 'image'
  const isVideo = clip && !isTextOnlyPrimary ? clip.kind === 'video' && !isImage : media?.type === 'video'
  const clipStart = clip?.start
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (playhead / duration) * 100)) : 0
  const isSequenceVertical = sequenceSize.height > sequenceSize.width

  // Proactive format detection from asset metadata or video element
  const assetItem = assets?.find((a) => a.id === sourceAssetId) ?? (media?.id === sourceAssetId ? media : undefined)
  const assetWidth = assetItem?.width ?? media?.width
  const assetHeight = assetItem?.height ?? media?.height

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const updateDimensions = () => {
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (vw > 0 && vh > 0) {
        setDetectedVideoFormat({ width: vw, height: vh, isVertical: vh > vw })
      }
    }
    updateDimensions()
    video.addEventListener('loadedmetadata', updateDimensions)
    video.addEventListener('loadeddata', updateDimensions)
    return () => {
      video.removeEventListener('loadedmetadata', updateDimensions)
      video.removeEventListener('loadeddata', updateDimensions)
    }
  }, [sourceState?.url, clip?.id, sourceAssetId])

  const effectiveFormat = detectedVideoFormat ?? (assetWidth && assetHeight ? {
    width: assetWidth,
    height: assetHeight,
    isVertical: assetHeight > assetWidth,
  } : null)

  const isVideoVertical = effectiveFormat ? effectiveFormat.isVertical : false
  const showAspectMismatchAlert = isVideo && !!effectiveFormat && (isVideoVertical !== isSequenceVertical)

  useEffect(() => {
    if (!sourceAssetId || (!isImage && !isVideo)) {
      return
    }
    let cancelled = false
    let nextUrl: string | null = null
    void loadMediaSource(sourceAssetId).then((url) => {
      nextUrl = url
      if (cancelled) { if (url) URL.revokeObjectURL(url); return }
      setSourceState({ assetId: sourceAssetId, status: url ? 'ready' : 'missing', ...(url ? { url } : {}) })
    }).catch(() => { if (!cancelled) setSourceState({ assetId: sourceAssetId, status: 'missing' }) })
    return () => { cancelled = true; if (nextUrl) URL.revokeObjectURL(nextUrl) }
  }, [sourceAssetId, isImage, isVideo])

  const sourceMatches = !!sourceAssetId && sourceState?.assetId === sourceAssetId
  const sourceUrl = sourceMatches && sourceState?.status === 'ready' ? sourceState.url : null
  const sourceLoading = !!sourceAssetId && !sourceMatches
  const sourceMissing = !!sourceAssetId && sourceMatches && sourceState?.status === 'missing'
  const hasActiveTextOverlays = textOverlays.length > 0

  const visualSources = useMemo(() => visualClips
    .filter((item) => item.kind !== 'adjustment' && item.text === undefined && item.thumbnail !== 'text-overlay')
    .map((item) => ({ clip: item, assetId: item.sourceAssetId ?? assets?.find((asset) => asset.title === item.title)?.id }))
    .filter((entry): entry is { clip: PreviewVisualClip; assetId: string } => !!entry.assetId), [visualClips, assets])
  const hasVisualLayer = visualSources.some(({ clip: item, assetId }) => layerSources[item.id]?.assetId === assetId && !!layerSources[item.id]?.url)
  const isPlayable = !!sourceUrl || hasActiveTextOverlays || hasVisualLayer || (duration > 0 && playing)

  useEffect(() => {
    let cancelled = false
    const wanted = new Map(visualSources.map(({ clip: item, assetId }) => [item.id, assetId]))
    const current = layerSourcesRef.current
    const retained = Object.fromEntries(Object.entries(current).filter(([clipId, source]) => {
      const keep = wanted.get(clipId) === source.assetId
      if (!keep && source.url) URL.revokeObjectURL(source.url)
      return keep
    }))
    layerSourcesRef.current = retained
    setLayerSources(retained)
    const missing = visualSources.filter(({ clip: item, assetId }) => retained[item.id]?.assetId !== assetId)
    void Promise.all(missing.map(async ({ clip: item, assetId }) => {
      try {
        return { clipId: item.id, assetId, url: await loadMediaSource(assetId) }
      } catch {
        return { clipId: item.id, assetId, url: null }
      }
    })).then((loaded) => {
      if (cancelled) {
        loaded.forEach(({ url }) => { if (url) URL.revokeObjectURL(url) })
        return
      }
      const next = { ...layerSourcesRef.current }
      loaded.forEach(({ clipId, assetId, url }) => {
        if (wanted.get(clipId) === assetId) next[clipId] = { assetId, url }
        else if (url) URL.revokeObjectURL(url)
      })
      layerSourcesRef.current = next
      setLayerSources(next)
    })
    return () => { cancelled = true }
  }, [visualSources])

  useEffect(() => () => {
    Object.values(layerSourcesRef.current).forEach(({ url }) => { if (url) URL.revokeObjectURL(url) })
    layerSourcesRef.current = {}
  }, [])

  useEffect(() => {
    const syncVideos = () => {
      for (const { clip: layerClip } of visualSources) {
        const video = layerVideoRefs.current.get(layerClip.id)
        if (!video || video.readyState < 1) continue
        const speed = layerClip.speed ?? 1
        const sourceTime = layerClip.freezeTime ?? Math.max(0, (playhead - layerClip.start) * speed)
        if (Math.abs(video.currentTime - sourceTime) > (playing ? 0.25 : 0.035)) {
          try { video.currentTime = sourceTime } catch { /* Browser will seek when metadata is ready. */ }
        }
        video.playbackRate = speed
        video.preservesPitch = layerClip.preservePitch ?? true
        video.muted = true
        if (playing && layerClip.freezeTime === undefined) void video.play().catch(() => {})
        else video.pause()
      }
    }
    syncVideos()
    if (!playing) return
    let frame = 0
    let active = true
    const tick = () => {
      if (!active) return
      syncVideos()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => { active = false; cancelAnimationFrame(frame) }
  }, [visualSources, layerSources, playhead, playing])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !sourceUrl || !isVideo) return
    const rawOffset = clipStart !== undefined ? Math.max(0, playhead - clipStart) : Math.max(0, playhead)
    const clipSpeed = clip?.speed ?? 1.0
    const sourceTime = clip?.freezeTime !== undefined ? clip.freezeTime : rawOffset * clipSpeed
    if (video.readyState >= 1 && Math.abs(video.currentTime - sourceTime) > (playing ? 0.35 : 0.04)) {
      try { video.currentTime = sourceTime } catch { /* The media element will seek when metadata is ready. */ }
    }
    video.playbackRate = clipSpeed
    video.preservesPitch = clip?.preservePitch ?? true
    video.volume = Math.max(0, Math.min(1, volume))
    video.muted = isMuted
    if (playing && clip?.freezeTime === undefined) {
      void video.play().catch(() => {
        // Fallback if browser policy blocks unmuted autoplay without prior interaction
        if (!video.muted) {
          video.muted = true
          void video.play().catch(() => {})
        }
      })
    } else {
      video.pause()
    }
  }, [sourceUrl, isVideo, clipStart, clip?.id, clip?.speed, clip?.preservePitch, clip?.freezeTime, playhead, playing, volume, isMuted])

  const toggleFullscreen = async () => {
    if (!stageRef.current) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await stageRef.current.requestFullscreen?.()
  }

  // Encaja el lienzo de la secuencia dentro del escenario disponible (como Premiere / Resolve)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setStageSize({ w: Math.round(rect.width), h: Math.round(rect.height) })
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const sequenceAspect = sequenceSize.width / Math.max(1, sequenceSize.height)
  const fitWidth = stageSize.w > 0 ? Math.max(0, Math.min(stageSize.w - 20, (stageSize.h - 20) * sequenceAspect)) : 0
  const zoomRatio = zoom === 'fit' ? 1 : zoom === '50%' ? 0.5 : zoom === '100%' ? 1 : 2
  const boxWidth = zoom === 'fit' ? fitWidth : Math.round(sequenceSize.width * zoomRatio)
  const boxHeight = boxWidth / sequenceAspect
  // Mismo factor que el render de exportación adaptado a la orientación (horizontal 1080 o vertical 1920)
  const refSequenceHeight = sequenceSize.height > sequenceSize.width ? 1920 : 1080
  const textUnit = boxHeight > 0 ? boxHeight / refSequenceHeight : 0.42
  const canvasBoxStyle = boxWidth > 0
    ? { width: `${Math.round(boxWidth)}px`, height: `${Math.round(boxHeight)}px` }
    : { aspectRatio: `${sequenceSize.width}/${sequenceSize.height}` }

  const isLegacyX = sequenceSize.width === 1080 && Math.abs(transform.x - 960) < 5 && (!clip?.keyframes || !clip.keyframes.some((k) => k.property === 'position'))
  const isLegacyY = sequenceSize.height === 1920 && Math.abs(transform.y - 540) < 5 && (!clip?.keyframes || !clip.keyframes.some((k) => k.property === 'position'))
  const effectiveTransformX = isLegacyX ? 540 : transform.x
  const effectiveTransformY = isLegacyY ? 960 : transform.y

  const scaleBoxX = boxWidth > 0 ? boxWidth / sequenceSize.width : 1
  const scaleBoxY = boxHeight > 0 ? boxHeight / sequenceSize.height : 1
  const offsetPxX = Math.round((effectiveTransformX - sequenceSize.width / 2) * scaleBoxX * 10) / 10
  const offsetPxY = Math.round((effectiveTransformY - sequenceSize.height / 2) * scaleBoxY * 10) / 10

  const clipFit = clip?.fit ?? 'fit'
  const objectFitStyle = clipFit === 'fill' ? 'cover' : clipFit === 'stretch' ? 'fill' : 'contain'
  const blendModeStyle = clip?.blendMode && clip.blendMode !== 'normal'
    ? (clip.blendMode === 'add' ? 'plus-lighter' : clip.blendMode)
    : undefined
  const flipScaleX = (clip?.flipH ? -1 : 1) * (transform.scaleX / 100)
  const flipScaleY = (clip?.flipV ? -1 : 1) * (transform.scaleY / 100)

  const transState = clip?.transitionIn
    ? computeTransitionInState(clip.transitionIn, clip.start, playhead, sequenceSize.width, sequenceSize.height)
    : null

  const combinedEffects = [...(clip?.effects ?? []), ...(adjustmentLayers?.flatMap((l) => l.effects ?? []) ?? [])]
  const effFilter = getEffectsCSSFilter(combinedEffects)
  const vignetteEffects = combinedEffects.filter((effect) => effect.enabled && effect.effectId === 'fx-vignette')
  const vignetteOverlay = vignetteEffects.length ? {
    position: 'absolute' as const,
    inset: 0,
    zIndex: 40,
    pointerEvents: 'none' as const,
    background: vignetteEffects.map((effect) => {
      const strength = (effect.intensity ?? 100) / 100
      const amount = Math.max(0, Math.min(1, (effect.params.amount ?? 50) / 100 * strength))
      const feather = Math.max(10, Math.min(100, effect.params.feather ?? 60))
      return `radial-gradient(ellipse at center, transparent ${Math.round(30 + feather * 0.35)}%, rgba(0, 0, 0, ${Math.min(0.85, 0.85 * amount)}) 100%)`
    }).join(', '),
  } : null

  const transOffsetX = transState ? (transState.offsetX / sequenceSize.width) * (boxWidth || 1) : 0
  const transOffsetY = transState ? (transState.offsetY / sequenceSize.height) * (boxHeight || 1) : 0
  const transScale = transState ? transState.scale : 1
  const transRotation = transState ? transState.rotation : 0
  const transOpacity = transState ? transState.opacity : 1

  const mediaTransform: React.CSSProperties = {
    transform: `translate(${offsetPxX + transOffsetX}px, ${offsetPxY + transOffsetY}px) scale(${flipScaleX * transScale}, ${flipScaleY * transScale}) rotate(${transform.rotation + transRotation}deg)`,
    opacity: clipOpacity * transOpacity,
    objectFit: objectFitStyle,
    mixBlendMode: blendModeStyle as React.CSSProperties['mixBlendMode'],
    filter: effFilter || undefined,
    clipPath: transState?.clipPath,
  }

  const getLayerStyle = (layerClip: PreviewVisualClip, order: number): React.CSSProperties => {
    const layerTransform = getInterpolatedTransform(layerClip, playhead, sequenceSize)
    const legacyCenter = sequenceSize.width === 1080 && sequenceSize.height === 1920 && Math.abs(layerTransform.x - 960) < 5 && Math.abs(layerTransform.y - 540) < 5 && !layerClip.keyframes?.some((keyframe) => keyframe.property === 'position')
    const x = legacyCenter ? sequenceSize.width / 2 : layerTransform.x
    const y = legacyCenter ? sequenceSize.height / 2 : layerTransform.y
    const fit = layerClip.fit ?? 'fit'
    const layerTransition = layerClip.transitionIn ? computeTransitionInState(layerClip.transitionIn, layerClip.start, playhead, sequenceSize.width, sequenceSize.height) : null
    const lowerAdjustmentEffects = adjustmentLayers
      .filter((adjustment) => adjustment.trackOrder < layerClip.trackOrder)
      .flatMap((adjustment) => adjustment.effects ?? [])
    const effects = [...(layerClip.effects ?? []), ...lowerAdjustmentEffects]
    const scaleX = (layerClip.flipH ? -1 : 1) * (layerTransform.scaleX / 100) * (layerTransition?.scale ?? 1)
    const scaleY = (layerClip.flipV ? -1 : 1) * (layerTransform.scaleY / 100) * (layerTransition?.scale ?? 1)
    const offsetX = ((x - sequenceSize.width / 2 + (layerTransition?.offsetX ?? 0)) / sequenceSize.width) * (boxWidth || 1)
    const offsetY = ((y - sequenceSize.height / 2 + (layerTransition?.offsetY ?? 0)) / sequenceSize.height) * (boxHeight || 1)
    return {
      position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit === 'fill' ? 'cover' : fit === 'stretch' ? 'fill' : 'contain',
      transform: `translate(${offsetX}px, ${offsetY}px) scale(${scaleX}, ${scaleY}) rotate(${layerTransform.rotation + (layerTransition?.rotation ?? 0)}deg)`,
      opacity: (getInterpolatedOpacity(layerClip, playhead) / 100) * (layerTransition?.opacity ?? 1),
      mixBlendMode: layerClip.blendMode === 'add' ? 'plus-lighter' : layerClip.blendMode === 'normal' ? undefined : layerClip.blendMode as React.CSSProperties['mixBlendMode'],
      filter: getEffectsCSSFilter(effects) || undefined,
      imageRendering: effects.some((effect) => effect.enabled && effect.effectId === 'fx-pixelate') ? 'pixelated' : undefined,
      clipPath: layerTransition?.clipPath,
      zIndex: order,
    }
  }

  const zoomLabel = zoom === 'fit' ? t('Ajustar', 'Fit') : zoom

  const commitTimecode = () => {
    if (timecodeDraft === null) return
    const parsed = parseTimecode(timecodeDraft, frameRate)
    if (parsed !== null) onSeek(Math.min(Math.max(0, parsed), Math.max(duration, 0)))
    setTimecodeDraft(null)
  }

  const updateHoverScrub = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)))
    setHoverScrub({ ratio, time: ratio * duration })
  }

  const startTextOverlayDrag = (event: React.PointerEvent, overlayClip: Clip) => {
    if (event.button !== 0 || inlineEditingClipId === overlayClip.id) return
    event.preventDefault()
    event.stopPropagation()
    onSelectClip?.(overlayClip.id)
    if (!onUpdateClip || !canvasBoxRef.current) return
    const rect = canvasBoxRef.current.getBoundingClientRect()
    const style = overlayClip.textStyle ?? getDefaultTextStyle()
    const baseTransform = overlayClip.transform ?? {
      x: sequenceSize.width / 2,
      y: sequenceSize.height / 2,
      scaleX: 100,
      scaleY: 100,
      rotation: 0,
    }
    const startX = event.clientX
    const startY = event.clientY
    const initialPosY = style.positionY
    const initialTransformX = baseTransform.x

    const move = (moveEvent: PointerEvent) => {
      const deltaYPercent = ((moveEvent.clientY - startY) / Math.max(100, rect.height)) * 100
      const deltaXRatio = (moveEvent.clientX - startX) / Math.max(100, rect.width)
      let nextY = Math.max(6, Math.min(94, Math.round(initialPosY + deltaYPercent)))
      let nextX = Math.max(
        Math.round(sequenceSize.width * 0.08),
        Math.min(
          Math.round(sequenceSize.width * 0.92),
          Math.round(initialTransformX + deltaXRatio * sequenceSize.width),
        ),
      )

      let snappedX = false
      let snappedYPos: number | null = null

      // Magnetic snap to center X (50%)
      const centerX = Math.round(sequenceSize.width / 2)
      const snapThresholdX = sequenceSize.width * 0.035
      if (Math.abs(nextX - centerX) < snapThresholdX) {
        nextX = centerX
        snappedX = true
      }

      // Magnetic snap to center Y (50%) or standard subtitle line (78%)
      if (Math.abs(nextY - 50) < 2.5) {
        nextY = 50
        snappedYPos = 50
      } else if (Math.abs(nextY - 78) < 2.5) {
        nextY = 78
        snappedYPos = 78
      }

      setSnapGuides({ x: snappedX, y: snappedYPos })

      onUpdateClip(overlayClip.id, {
        textStyle: { ...style, positionY: nextY },
        transform: { ...baseTransform, x: nextX },
      })
    }
    const end = () => {
      setSnapGuides({ x: false, y: null })
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end, { once: true })
  }

  const startResizeHandleDrag = (
    event: React.PointerEvent,
    overlayClip: Clip,
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    if (!onUpdateClip) return
    const style = overlayClip.textStyle ?? getDefaultTextStyle()
    const startFontSize = style.fontSize
    const startX = event.clientX
    const startY = event.clientY

    const targetEl = (event.target as HTMLElement).closest('.preview-text-overlay-box')
    const boxRect = targetEl?.getBoundingClientRect()
    const centerX = boxRect ? boxRect.left + boxRect.width / 2 : startX
    const centerY = boxRect ? boxRect.top + boxRect.height / 2 : startY
    const startDist = Math.max(20, Math.hypot(startX - centerX, startY - centerY))

    const move = (moveEvent: PointerEvent) => {
      const currDist = Math.hypot(moveEvent.clientX - centerX, moveEvent.clientY - centerY)
      const scaleFactor = currDist / startDist
      const nextFontSize = Math.max(14, Math.min(130, Math.round(startFontSize * scaleFactor)))
      onUpdateClip(overlayClip.id, {
        textStyle: { ...style, fontSize: nextFontSize },
      })
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end, { once: true })
  }

  const handleStartInlineEdit = (overlayClip: Clip, initialText: string) => {
    setInlineEditingClipId(overlayClip.id)
    setInlineEditText(overlayClip.text ?? initialText)
    setTimeout(() => inlineInputRef.current?.focus(), 25)
  }

  const handleCommitInlineEdit = (clipId: string) => {
    if (inlineEditingClipId !== clipId) return
    const trimmed = inlineEditText.trim()
    if (trimmed && onUpdateClip) {
      onUpdateClip(clipId, { text: trimmed, title: trimmed })
    }
    setInlineEditingClipId(null)
  }

  return <section className="preview-panel">
    <div className="h-9 px-3 flex items-center justify-between border-b border-border bg-card select-none">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[13px] font-semibold text-foreground whitespace-nowrap shrink-0">{t('Secuencia 01', 'Sequence 01')}</span>
        {showAspectMismatchAlert && onSetSequence && (
          <button
            type="button"
            className="monitor-adapt-sequence-banner inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-primary/20 text-primary border border-primary/30 text-[11px] hover:bg-primary/30 transition-colors shrink-0"
            title={isVideoVertical
              ? t('Clic para adaptar la secuencia a formato vertical 9:16 (1080×1920)', 'Click to adapt sequence to vertical 9:16 (1080×1920)')
              : t('Clic para adaptar la secuencia a formato horizontal 16:9 (1920×1080)', 'Click to adapt sequence to horizontal 16:9 (1920×1080)')}
            onClick={() => {
              onSetSequence({
                width: isVideoVertical ? 1080 : 1920,
                height: isVideoVertical ? 1920 : 1080,
                frameRate,
              })
            }}
          >
            {isVideoVertical ? <Smartphone size={12} aria-hidden="true" /> : <Monitor size={12} aria-hidden="true" />}
            <span className="whitespace-nowrap">
              {isVideoVertical
                ? t('9:16 detectado · Adaptar', '9:16 detected · Adapt')
                : t('16:9 detectado · Adaptar', '16:9 detected · Adapt')}
            </span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap shrink-0">{sequenceSize.width} × {sequenceSize.height} · {Math.round(frameRate)} fps</span>
        <span className="h-7 px-2.5 text-xs rounded-[6px] bg-input text-muted-foreground inline-flex items-center" title={t('La calidad de previsualización aún no se puede cambiar.', 'Preview quality cannot be changed yet.')}>{t('Previsualización: Alta', 'Preview: High')}</span>
      </div>
    </div>
    <div className={`preview-stage ${zoom !== 'fit' ? 'is-zoomed' : ''}`} ref={stageRef}>
      {showAspectMismatchAlert && onSetSequence && (
        <div className="preview-stage-format-pill-wrapper" role="region" aria-label={t('Alerta de proporción de aspecto', 'Aspect ratio alert')}>
          <button
            type="button"
            className="preview-stage-format-pill"
            onClick={() => {
              onSetSequence({
                width: isVideoVertical ? 1080 : 1920,
                height: isVideoVertical ? 1920 : 1080,
                frameRate,
              })
              toast.success(
                isVideoVertical
                  ? t('Secuencia adaptada a vertical 9:16 (1080×1920)', 'Sequence adapted to vertical 9:16 (1080×1920)')
                  : t('Secuencia adaptada a horizontal 16:9 (1920×1080)', 'Sequence adapted to horizontal 16:9 (1920×1080)'),
                {
                  description: t('Adaptado automáticamente al formato del vídeo sin bandas negras.', 'Adjusted automatically to video format without black bars.'),
                },
              )
            }}
            title={isVideoVertical
              ? t('Clic para adaptar la secuencia a 1080×1920 (9:16) y eliminar bandas negras', 'Click to adapt sequence to 1080×1920 (9:16) and eliminate black bars')
              : t('Clic para adaptar la secuencia a 1920×1080 (16:9)', 'Click to adapt sequence to 1920×1080 (16:9)')}
          >
            <span className="pill-badge-icon">{isVideoVertical ? <Smartphone size={14} aria-hidden="true" /> : <Monitor size={14} aria-hidden="true" />}</span>
            <span className="pill-text-block">
              <strong>{isVideoVertical ? t('Vídeo vertical 9:16 detectado', 'Vertical 9:16 video detected') : t('Vídeo horizontal 16:9 detectado', 'Horizontal 16:9 video detected')}</strong>
              <small>{isVideoVertical ? t('Clic para adaptar secuencia a 1080×1920 (pantalla completa)', 'Click to adapt sequence to 1080×1920 (fullscreen)') : t('Clic para adaptar secuencia a 1920×1080 (pantalla completa)', 'Click to adapt sequence to 1920×1080 (fullscreen)')}</small>
            </span>
            <span className="pill-action-tag">{t('Adaptar ahora', 'Adapt now')}</span>
          </button>
        </div>
      )}
      <div ref={canvasBoxRef} className={`preview-image ${sourceUrl || hasVisualLayer || hasActiveTextOverlays ? 'preview-image-loaded' : 'preview-empty-image'}`} style={{ ...canvasBoxStyle, position: 'relative' }}>
        {visualSources.map(({ clip: layerClip, assetId }, index) => {
          const loadedSource = layerSources[layerClip.id]
          const url = loadedSource?.assetId === assetId ? loadedSource.url : null
          const asset = assets?.find((item) => item.id === assetId)
          const isLayerImage = asset?.type === 'image' || layerClip.thumbnail === 'image-catalog'
          const layerStyle = getLayerStyle(layerClip, index + 1)
          const adjustmentEffects = adjustmentLayers.filter((adjustment) => adjustment.trackOrder < layerClip.trackOrder).flatMap((adjustment) => adjustment.effects ?? [])
          const effectOverlays = getPreviewEffectOverlays([...(layerClip.effects ?? []), ...adjustmentEffects])
          if (!url) return null
          return <Fragment key={layerClip.id}>
            {isLayerImage ? <img className="preview-media-image preview-media-layer" style={layerStyle} src={url} alt={layerClip.title} /> : <video
              ref={(node) => { if (node) layerVideoRefs.current.set(layerClip.id, node); else layerVideoRefs.current.delete(layerClip.id) }}
              className="preview-media-image preview-media-layer"
              style={layerStyle}
              src={url}
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={(event) => {
                const video = event.currentTarget
                const speed = layerClip.speed ?? 1
                const sourceTime = layerClip.freezeTime ?? Math.max(0, (playhead - layerClip.start) * speed)
                try { video.currentTime = sourceTime } catch { /* Browser will seek when metadata is ready. */ }
                video.playbackRate = speed
                video.preservesPitch = layerClip.preservePitch ?? true
                if (playing && layerClip.freezeTime === undefined) void video.play().catch(() => {})
              }}
            />}
            {effectOverlays.map((overlay) => <div key={overlay.id} aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: index + 1.5, pointerEvents: 'none', opacity: overlay.opacity, backgroundImage: overlay.image, backgroundSize: overlay.size, mixBlendMode: overlay.blend }} />)}
          </Fragment>
        })}
        {visualClips.length === 0 && sourceUrl && isImage && <img className="preview-media-image" style={mediaTransform} src={sourceUrl} alt={previewTitle ?? ''} />}
        {visualClips.length === 0 && sourceUrl && isVideo && <video key={`${sourceAssetId}-${clip?.id ?? 'library'}`} ref={videoRef} className="preview-media-image" style={mediaTransform} src={sourceUrl} muted={isMuted} playsInline preload="auto" onLoadedMetadata={(event) => {
          const video = event.currentTarget
          const vw = video.videoWidth
          const vh = video.videoHeight
          if (vw > 0 && vh > 0) {
            setDetectedVideoFormat({ width: vw, height: vh, isVertical: vh > vw })
            if (sourceAssetId) {
              const currentAsset = useEditorStore.getState().assets.find((a) => a.id === sourceAssetId)
              if (currentAsset && (!currentAsset.width || !currentAsset.height)) {
                useEditorStore.getState().updateAsset(sourceAssetId, { width: vw, height: vh })
              }
            }
          }
          video.volume = Math.max(0, Math.min(1, volume))
          video.muted = isMuted
          if (clip && Math.abs(clip.duration - 6) < 0.08 && Number.isFinite(video.duration) && video.duration > 6.5) {
            const realDur = Math.round(video.duration * frameRate) / frameRate
            onUpdateClip?.(clip.id, {
              duration: realDur,
              ...(clip.start > 0 && clip.start <= 0.16 ? { start: 0 } : {}),
            })
          }
          const clipSpeed = clip?.speed ?? 1.0
          const seekTime = clip?.freezeTime !== undefined
            ? clip.freezeTime
            : (clipStart !== undefined ? Math.max(0, (playhead - clipStart) * clipSpeed) : Math.max(0, playhead * clipSpeed))
          try { video.currentTime = seekTime } catch { /* The browser will seek when metadata is ready. */ }
          if (playing && clip?.freezeTime === undefined) void video.play().catch(() => { })
        }} onTimeUpdate={(event) => {
          if (playing && clip?.freezeTime === undefined) {
            const clipSpeed = clip?.speed ?? 1.0
            const next = clipStart !== undefined
              ? clipStart + event.currentTarget.currentTime / clipSpeed
              : event.currentTarget.currentTime / clipSpeed
            if (Math.abs(next - playhead) > 0.12) onSeek(duration > 0 ? Math.min(duration, next) : next)
          }
        }} />}
        {vignetteOverlay && (sourceUrl || hasVisualLayer) && <div aria-hidden="true" style={vignetteOverlay} />}
        {!sourceUrl && !hasVisualLayer && !hasActiveTextOverlays && (
          <div className="preview-empty-copy">
            {sourceLoading ? <LoaderCircle size={20} className="spin" aria-hidden="true" /> : <Film size={20} strokeWidth={1.6} aria-hidden="true" />}
            <strong>{previewTitle ?? t('La vista previa aparecerá aquí', 'Preview will appear here')}</strong>
            <span>{sourceLoading ? t('Cargando medio…', 'Loading media…') : sourceMissing ? t('Vuelve a vincular el archivo para ver su contenido.', 'Relink the file to preview its contents.') : clip || media ? t('Este tipo de medio todavía no tiene vista previa.', 'This media type does not have preview support yet.') : t('Coloca un clip en la línea de tiempo o selecciona un medio.', 'Place a clip on the timeline or select media.')}</span>
          </div>
        )}
        {textOverlays.map((textClip) => {
          const style = textClip.textStyle ?? getDefaultTextStyle()
          const anim = computeTextAnimationState(textClip, playhead)
          const isSelected = selectedClipId === textClip.id && !playing
          const isEditing = inlineEditingClipId === textClip.id
          const tTransform = textClip.transform ?? {
            x: sequenceSize.width / 2,
            y: sequenceSize.height / 2,
            scaleX: 100,
            scaleY: 100,
            rotation: 0,
          }
          const posXPercent = Math.max(6, Math.min(94, Math.round((tTransform.x / Math.max(1, sequenceSize.width)) * 1000) / 10))
          const posYPercent = Math.max(6, Math.min(94, style.positionY ?? 78))
          const customScaleX = (tTransform.scaleX ?? 100) / 100
          const customScaleY = (tTransform.scaleY ?? 100) / 100
          const customRot = tTransform.rotation ?? 0
          const clipAlpha = (textClip.opacity ?? 100) / 100
          const fontScale = Math.max(8, Math.round(style.fontSize * textUnit * 10) / 10)
          // El export dibuja el contorno centrado (lineWidth); la mitad queda por fuera del glifo
          const strokePx = Math.max(0, Math.round(style.strokeWidth * textUnit * 0.5 * 10) / 10)
          const textShadowParts: string[] = []
          if (style.shadowBlur > 0) {
            textShadowParts.push(`0 ${Math.max(1, Math.round(4 * textUnit))}px ${Math.round(style.shadowBlur * textUnit)}px ${style.shadowColor}`)
          }
          if (strokePx > 0) {
            textShadowParts.push(
              `-${strokePx}px -${strokePx}px 0 ${style.strokeColor}`,
              `${strokePx}px -${strokePx}px 0 ${style.strokeColor}`,
              `-${strokePx}px ${strokePx}px 0 ${style.strokeColor}`,
              `${strokePx}px ${strokePx}px 0 ${style.strokeColor}`,
            )
          }
          return (
            <div
              key={textClip.id}
              data-testid={`preview-text-overlay-${textClip.id}`}
              className={`preview-text-overlay-anchor align-${style.align} ${isSelected ? 'selected' : ''} ${isEditing ? 'is-editing' : ''}`}
              style={{
                top: `${posYPercent}%`,
                left: `${posXPercent}%`,
                transform: 'translate(-50%, -50%)',
                opacity: anim.opacity * clipAlpha,
              }}
              onPointerDown={(e) => startTextOverlayDrag(e, textClip)}
              onDoubleClick={(e) => {
                e.stopPropagation()
                handleStartInlineEdit(textClip, anim.displayText)
              }}
            >
              {isSelected && !isEditing && (
                <div className="preview-text-floating-bar" onPointerDown={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="floating-action-btn"
                    title={t('Editar texto (o haz doble clic)', 'Edit text (or double click)')}
                    onClick={() => handleStartInlineEdit(textClip, anim.displayText)}
                  >
                    <Pencil size={11} />
                    <span>{t('Editar', 'Edit')}</span>
                  </button>
                  <button
                    type="button"
                    className="floating-action-btn"
                    title={t('Centrar horizontal y vertical', 'Center horizontal and vertical')}
                    onClick={() => {
                      onUpdateClip?.(textClip.id, {
                        transform: {
                          ...(textClip.transform ?? { scaleX: 100, scaleY: 100, rotation: 0, y: sequenceSize.height / 2 }),
                          x: sequenceSize.width / 2,
                        },
                        textStyle: { ...style, positionY: 50 },
                      })
                    }}
                  >
                    <span>{t('Centrar', 'Center')}</span>
                  </button>
                  <button
                    type="button"
                    className="floating-action-btn"
                    title={t('Reducir letra (A-)', 'Decrease font size (A-)')}
                    onClick={() => {
                      onUpdateClip?.(textClip.id, {
                        textStyle: { ...style, fontSize: Math.max(14, style.fontSize - 4) },
                      })
                    }}
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    className="floating-action-btn"
                    title={t('Aumentar letra (A+)', 'Increase font size (A+)')}
                    onClick={() => {
                      onUpdateClip?.(textClip.id, {
                        textStyle: { ...style, fontSize: Math.min(130, style.fontSize + 4) },
                      })
                    }}
                  >
                    A+
                  </button>
                  {onDuplicateClip && (
                    <button
                      type="button"
                      className="floating-action-btn"
                      title={t('Duplicar subtítulo', 'Duplicate subtitle')}
                      onClick={() => onDuplicateClip(textClip.id)}
                    >
                      <Copy size={11} />
                    </button>
                  )}
                  {onDeleteClip && (
                    <button
                      type="button"
                      className="floating-action-btn danger"
                      title={t('Eliminar subtítulo', 'Delete subtitle')}
                      onClick={() => onDeleteClip(textClip.id)}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              )}

              <div
                className="preview-text-overlay-box"
                style={{
                  fontFamily: style.fontFamily,
                  fontSize: `${fontScale}px`,
                  fontWeight: style.fontWeight,
                  fontStyle: style.italic ? 'italic' : 'normal',
                  letterSpacing: `${Math.round(style.letterSpacing * textUnit * 10) / 10}px`,
                  color: style.color,
                  textAlign: style.align,
                  backgroundColor: style.backgroundOpacity > 0 ? hexToRgbaCss(style.backgroundColor, style.backgroundOpacity) : 'transparent',
                  borderRadius: `${Math.round(style.backgroundRadius * textUnit * 10) / 10}px`,
                  padding: style.backgroundOpacity > 0 ? `${Math.round(12 * textUnit)}px ${Math.round(22 * textUnit)}px` : `${Math.round(4 * textUnit)}px ${Math.round(10 * textUnit)}px`,
                  textShadow: textShadowParts.join(', ') || 'none',
                  transform: `translate(${(anim.translateXPx + anim.glitchShiftPx) * textUnit}px, ${anim.translateYPx * textUnit}px) scale(${anim.scaleX * customScaleX}, ${anim.scaleY * customScaleY}) rotate(${anim.rotationDeg + customRot}deg)`,
                }}
              >
                {isEditing ? (
                  <textarea
                    ref={inlineInputRef}
                    autoFocus
                    className="preview-text-inline-editor"
                    rows={Math.max(1, inlineEditText.split('\n').length)}
                    value={inlineEditText}
                    onChange={(e) => setInlineEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleCommitInlineEdit(textClip.id)
                      } else if (e.key === 'Escape') {
                        setInlineEditingClipId(null)
                      }
                      e.stopPropagation()
                    }}
                    onBlur={() => handleCommitInlineEdit(textClip.id)}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                ) : anim.isKaraoke ? (
                  <span className="preview-karaoke-words">
                    {anim.words.map((word, wIdx) => {
                      const isActive = wIdx === anim.activeWordIndex
                      const isPast = wIdx < anim.activeWordIndex
                      return (
                        <span
                          key={wIdx}
                          className={`preview-karaoke-word ${isActive ? 'active' : isPast ? 'past' : ''}`}
                          style={isActive ? { color: style.accentColor } : undefined}
                        >
                          {word}{' '}
                        </span>
                      )
                    })}
                  </span>
                ) : (
                  <span className="preview-text-lines">
                    {anim.displayText}
                    {anim.isTypewriter && <span className="preview-typewriter-caret" aria-hidden="true">|</span>}
                  </span>
                )}

                {isSelected && !isEditing && (
                  <>
                    <div className="text-rotation-badge">
                      {Math.round(customScaleX * 100)}% - {Math.round(customRot)}°
                    </div>
                    <div className="text-rotation-handle" />
                    <div className="text-rotation-knob" title={t('Rotación del texto', 'Text rotation')} />
                    <div
                      className="preview-text-resize-handle handle-nw"
                      title={t('Arrastra para cambiar tamaño de letra', 'Drag to resize font')}
                      onPointerDown={(e) => startResizeHandleDrag(e, textClip)}
                    />
                    <div
                      className="preview-text-resize-handle handle-ne"
                      title={t('Arrastra para cambiar tamaño de letra', 'Drag to resize font')}
                      onPointerDown={(e) => startResizeHandleDrag(e, textClip)}
                    />
                    <div
                      className="preview-text-resize-handle handle-sw"
                      title={t('Arrastra para cambiar tamaño de letra', 'Drag to resize font')}
                      onPointerDown={(e) => startResizeHandleDrag(e, textClip)}
                    />
                    <div
                      className="preview-text-resize-handle handle-se"
                      title={t('Arrastra para cambiar tamaño de letra', 'Drag to resize font')}
                      onPointerDown={(e) => startResizeHandleDrag(e, textClip)}
                    />
                  </>
                )}
              </div>
            </div>
          )
        })}
        {snapGuides.x && (
          <div className="preview-snap-guide-v" aria-hidden="true">
            <span className="guide-label">{t('Centro', 'Center')}</span>
          </div>
        )}
        {snapGuides.y !== null && (
          <div className="preview-snap-guide-h" style={{ top: `${snapGuides.y}%` }} aria-hidden="true">
            <span className="guide-label">{snapGuides.y === 50 ? t('Centro 50%', 'Center 50%') : t('Subtítulo 78%', 'Subtitle 78%')}</span>
          </div>
        )}
        {safeMargins && <div className="safe-margins" aria-hidden="true"><i /><i /></div>}
        {thirds && <div className="thirds-guides" aria-hidden="true"><i /><i /><i /><i /></div>}
      </div>
    </div>
    <div
      className="monitor-scrub"
      onPointerMove={updateHoverScrub}
      onPointerLeave={() => setHoverScrub(null)}
    >
      <div className="scrub-track">
        <div className="scrub-selection" style={{ left: `${duration && clip ? clip.start / duration * 100 : 0}%`, width: `${duration && clip ? clip.duration / duration * 100 : 0}%` }} />
        <div className="scrub-progress" style={{ width: `${progressPercent}%` }} />
        {markers.map((marker) => <i key={marker.id} title={`${marker.label} · ${formatTimecode(marker.time, frameRate)}`} style={{ left: `${duration ? marker.time / duration * 100 : 0}%` }} />)}
        {hoverScrub && duration > 0 && (
          <>
            <span className="scrub-hover-line" style={{ left: `${hoverScrub.ratio * 100}%` }} aria-hidden="true" />
            <span className="scrub-hover-time" style={{ left: `${hoverScrub.ratio * 100}%` }} aria-hidden="true">{formatTimecode(hoverScrub.time, frameRate)}</span>
          </>
        )}
        <span className="scrub-playhead-thumb" style={{ left: `${progressPercent}%` }} aria-hidden="true" />
        <input aria-label={t('Buscar tiempo en la secuencia', 'Seek through sequence')} type="range" min="0" max={Math.max(duration, 0.01)} step={1 / frameRate} value={Math.min(playhead, Math.max(duration, 0.01))} onChange={(event) => onSeek(Number(event.target.value))} />
      </div>
    </div>
    <div className="preview-controls monitor-transport-bar">
      <div className="transport-hud-left">
        {timecodeDraft !== null ? (
          <input
            className="timecode-input"
            aria-label={t('Ir a código de tiempo', 'Go to timecode')}
            autoFocus
            value={timecodeDraft}
            onChange={(event) => setTimecodeDraft(event.target.value)}
            onBlur={commitTimecode}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitTimecode()
              if (event.key === 'Escape') setTimecodeDraft(null)
              event.stopPropagation()
            }}
          />
        ) : (
          <button
            type="button"
            className="timecode timecode-current timecode-button text-primary font-mono tabular-nums font-semibold text-xs"
            title={t('Clic para escribir un código de tiempo', 'Click to type a timecode')}
            onClick={() => setTimecodeDraft(timecode)}
          >
            {timecode}
          </button>
        )}
        <span className="timecode total-time font-mono tabular-nums text-muted-foreground text-xs">/ {formatTimecode(duration, frameRate)}</span>
      </div>
      <div className="transport flex items-center gap-1.5">
        <button
          type="button"
          className="w-8 h-8 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-input border-0 flex items-center justify-center cursor-pointer transition-colors"
          aria-label={t('Ir al inicio', 'Go to start')}
          title={t('Ir al inicio', 'Go to start')}
          onClick={() => onSeek(0)}
        >
          <SkipBack size={14} />
        </button>
        <button
          type="button"
          className="w-8 h-8 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-input border-0 flex items-center justify-center cursor-pointer transition-colors"
          aria-label={t('Fotograma anterior', 'Previous frame')}
          title={t('Fotograma anterior', 'Previous frame')}
          onClick={() => onSeek(Math.max(0, playhead - 1 / frameRate))}
        >
          <ChevronLeft size={16} />
        </button>
        {isPlayable ? (
          <button
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer select-none bg-primary text-primary-foreground shadow-md hover:brightness-110 active:scale-95 border-0',
              playing && 'ring-2 ring-primary/40'
            )}
            aria-label={playing ? t('Pausar', 'Pause') : t('Reproducir', 'Play')}
            title={playing ? t('Pausar reproducción (Espacio)', 'Pause playback (Space)') : t('Reproducir secuencia (Espacio)', 'Play sequence (Space)')}
            onClick={onTogglePlay}
          >
            {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
          </button>
        ) : (
          <button
            className="w-10 h-10 rounded-full flex items-center justify-center bg-muted text-muted-foreground/40 cursor-not-allowed select-none border-0"
            aria-label={t('Reproducción no disponible', 'Playback unavailable')}
            disabled
          >
            <Play size={15} fill="currentColor" className="ml-0.5" />
          </button>
        )}
        <button
          type="button"
          className="w-8 h-8 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-input border-0 flex items-center justify-center cursor-pointer transition-colors"
          aria-label={t('Fotograma siguiente', 'Next frame')}
          title={t('Fotograma siguiente', 'Next frame')}
          onClick={() => onSeek(Math.min(duration, playhead + 1 / frameRate))}
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          className="w-8 h-8 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-input border-0 flex items-center justify-center cursor-pointer transition-colors"
          aria-label={t('Ir al final', 'Go to end')}
          title={t('Ir al final', 'Go to end')}
          onClick={() => onSeek(duration)}
        >
          <SkipForward size={14} />
        </button>
      </div>
      <div className="transport-hud-right flex items-center gap-1.5">
        <ActionMenu
          label={t('Zoom del monitor', 'Monitor zoom')}
          triggerClass="h-7 px-2.5 rounded-[6px] bg-input border-0 text-xs text-foreground flex items-center gap-1 cursor-pointer hover:bg-input-hover transition-colors"
          popupClass="monitor-zoom-popup"
          items={([
            ['fit', t('Ajustar', 'Fit')],
            ['50%', '50%'],
            ['100%', '100%'],
            ['200%', '200%'],
          ] as const).map(([value, label]) => ({
            label,
            checked: zoom === value,
            onSelect: () => setZoom(value as ZoomPreset),
          }))}
        >
          <span>{zoomLabel}</span>
          <ChevronDown size={11} aria-hidden="true" className="text-muted-foreground" />
        </ActionMenu>
        <button
          type="button"
          className="w-8 h-8 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-input border-0 flex items-center justify-center cursor-pointer transition-colors"
          aria-label={t('Monitor a pantalla completa', 'Fullscreen monitor')}
          title={t('Pantalla completa', 'Fullscreen')}
          onClick={() => void toggleFullscreen()}
        >
          <Expand size={14} />
        </button>
      </div>
    </div>
  </section>
}
