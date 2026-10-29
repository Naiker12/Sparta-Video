import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'
import type { Clip, MediaItem, SequenceSettings, TimelineMarker, Track } from './model'
import { getMediaTypeFromName, parseDurationFromDetail } from './services/media-storage'
import { getDefaultTextAnimation, getDefaultTextStyle, getTextPreset, TEXT_STYLE_PRESETS } from './services/text-presets'

export type AddTextClipOptions = {
  text?: string
  presetId?: string
  at?: number
  duration?: number
  trackId?: string
}

export type SubtitleEntryInput = {
  text: string
  start: number
  duration: number
  presetId?: string
}

export type ProjectSnapshot = Pick<EditorState, 'projectName' | 'sequence' | 'tracks' | 'assets' | 'markers' | 'snapToFrames' | 'mutedTracks' | 'lockedTracks' | 'selectedClipId' | 'selectedMediaId'>
export type EditorState = {
  projectName: string; sequence: SequenceSettings; tracks: Track[]; assets: MediaItem[]; markers: TimelineMarker[]
  selectedClipId: string; selectedMediaId: string | null; playhead: number; zoom: number; playing: boolean; snapToFrames: boolean
  activeTool: 'select' | 'razor'
  mutedTracks: string[]; lockedTracks: string[]; past: ProjectSnapshot[]; future: ProjectSnapshot[]
  setProjectName: (name: string) => void; setSequence: (sequence: SequenceSettings) => void
  setActiveTool: (tool: 'select' | 'razor') => void
  selectClip: (id: string) => void; selectMedia: (id: string) => void; setPlayhead: (time: number) => void
  setZoom: (zoom: number) => void; setPlaying: (playing: boolean) => void; addAssets: (assets: MediaItem[]) => void
  updateAsset: (assetId: string, changes: Partial<Pick<MediaItem, 'title' | 'type' | 'detail' | 'thumb' | 'status' | 'durationSeconds'>>) => void; removeAsset: (assetId: string) => void
  addMedia: (asset: MediaItem, at?: number, trackId?: string) => string
  addTextClip: (options?: AddTextClipOptions) => string
  addSubtitleSequence: (entries: SubtitleEntryInput[], options?: { replaceExisting?: boolean }) => number
  clearAllSubtitles: () => number
  applyPresetToAllSubtitles: (presetId: string) => number
  calibrateAllSubtitles: (sourceClipId: string) => number
  nudgeAllSubtitlesTime: (deltaSeconds: number) => number
  autoGenerateSubtitles: (presetId?: string, customScript?: string) => number
  updateClip: (clipId: string, changes: Partial<Clip>) => void
  moveClip: (clipId: string, start: number, duration?: number) => void; moveClipToNewTrack: (clipId: string) => void; splitClip: (clipId: string, time: number) => void
  deleteClip: (clipId: string) => void; duplicateClip: (clipId: string) => string; ripplePackTrack: (trackId?: string) => number; autoAudioBalance: () => number; autoSceneMarkers: () => number
  addMarker: (time: number, label?: string) => void; removeMarker: (markerId: string) => void; toggleSnap: () => void; addTrack: (kind: 'video' | 'audio') => void
  toggleMute: (id: string) => void; toggleLock: (id: string) => void; undo: () => void; redo: () => void
  loadProject: (project: PersistedProjectState) => void; resetProject: () => void
}
export type PersistedProjectState = Pick<EditorState, 'projectName' | 'sequence' | 'tracks' | 'assets' | 'markers' | 'snapToFrames' | 'mutedTracks' | 'lockedTracks'>

let nextClip = 10
let nextMarker = 1
let lastHistoryGroup: string | null = null
let lastHistoryGroupAt = 0
const copyTracks = (tracks: Track[]): Track[] => tracks.map((track) => ({
  ...track,
  clips: track.clips.map((clip) => ({
    ...clip,
    transform: clip.transform ? { ...clip.transform } : undefined,
    keyframes: clip.keyframes?.map((keyframe) => ({ ...keyframe })),
    textStyle: clip.textStyle ? { ...clip.textStyle } : undefined,
    textAnimation: clip.textAnimation ? { ...clip.textAnimation } : undefined,
  })),
}))
const copyMarkers = (markers: TimelineMarker[]) => markers.map((marker) => ({ ...marker }))
const copySnapshot = (state: ProjectSnapshot): ProjectSnapshot => ({ ...state, sequence: { ...state.sequence }, tracks: copyTracks(state.tracks), assets: state.assets.map((asset) => ({ ...asset })), markers: copyMarkers(state.markers), mutedTracks: [...state.mutedTracks], lockedTracks: [...state.lockedTracks] })
const snapshot = (state: EditorState): ProjectSnapshot => copySnapshot(state)
const applySnapshot = (state: ProjectSnapshot): ProjectSnapshot => copySnapshot(state)
const commit = (state: EditorState, updates: Partial<EditorState>, groupKey?: string): Partial<EditorState> => {
  const now = Date.now()
  const coalesce = !!groupKey && groupKey === lastHistoryGroup && now - lastHistoryGroupAt < 500
  lastHistoryGroup = groupKey ?? null
  lastHistoryGroupAt = now
  return { ...updates, past: coalesce ? state.past : [...state.past.slice(-49), snapshot(state)], future: [] }
}
let lastStoredProject: PersistedProjectState | null = null
export type ProjectSaveStatus = 'saving' | 'saved' | 'unsaved' | 'error'
let projectSaveStatus: ProjectSaveStatus = 'unsaved'
const PROJECT_SAVE_EVENT = 'sparta-project-save-status'
const publishSaveStatus = (status: ProjectSaveStatus) => {
  projectSaveStatus = status
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<ProjectSaveStatus>(PROJECT_SAVE_EVENT, { detail: status }))
}
export const getProjectSaveStatus = () => projectSaveStatus

const emptyTracks = (): Track[] => [
  { id: 'v1', name: 'Video 01', kind: 'video', clips: [] },
  { id: 'a1', name: 'Audio 01', kind: 'audio', clips: [] },
]
const cleanSeededProject = (state: PersistedProjectState): PersistedProjectState => {
  const sampleTitles = ['coastline_drone_04.mp4', 'harbor_sunrise.mov', 'coastal-drift.wav', 'cliffside_walk.mp4']
  const isUntouchedSeed = state.projectName === 'Coastal film'
    && state.assets.length === sampleTitles.length
    && sampleTitles.every((title) => state.assets.some((asset) => asset.title === title))
    && state.assets.every((asset) => sampleTitles.includes(asset.title))
    && state.tracks.every((track) => track.clips.every((clip) => sampleTitles.includes(clip.title)))
  return isUntouchedSeed ? {
    ...state,
    projectName: 'Sin título',
    sequence: { width: 1920, height: 1080, frameRate: 24 },
    tracks: emptyTracks(), assets: [], markers: [], snapToFrames: true, mutedTracks: [], lockedTracks: [],
  } : state
}
const normalizeLegacyMediaTypes = (state: PersistedProjectState): PersistedProjectState => {
  let changed = false
  const assetByTitle = new Map(state.assets.map((asset) => [asset.title, asset]))
  const assets = state.assets.map((asset) => {
    const type = getMediaTypeFromName(asset.title)
    if (!type || type === asset.type) return asset
    changed = true
    const details = asset.detail.split('·').slice(1).map((part) => part.trim()).filter(Boolean)
    return { ...asset, type, thumb: type === 'image' ? 'image-catalog' : type === 'audio' ? 'wave' : 'video-catalog', detail: [type.toUpperCase(), ...details].join(' · ') }
  })
  const tracks = state.tracks.map((track) => {
    let trackChanged = false
    const clips = track.clips.map((clip) => {
      if (clip.sourceAssetId) return clip
      const asset = assetByTitle.get(clip.title)
      if (!asset) return clip
      changed = true
      trackChanged = true
      return { ...clip, sourceAssetId: asset.id }
    })
    return trackChanged ? { ...track, clips } : track
  })
  return changed ? { ...state, assets, tracks } : state
}
export const retryProjectSave = () => {
  lastStoredProject = null
  const state = useEditorStore.getState()
  const persisted: PersistedProjectState = { projectName: state.projectName, sequence: state.sequence, tracks: state.tracks, assets: state.assets, markers: state.markers, snapToFrames: state.snapToFrames, mutedTracks: state.mutedTracks, lockedTracks: state.lockedTracks }
  projectStorage.setItem('sparta-video-project-v1', { state: persisted, version: 0 })
}
export const subscribeProjectSaveStatus = (listener: (status: ProjectSaveStatus) => void) => {
  const handle = (event: Event) => listener((event as CustomEvent<ProjectSaveStatus>).detail)
  window.addEventListener(PROJECT_SAVE_EVENT, handle)
  return () => window.removeEventListener(PROJECT_SAVE_EVENT, handle)
}
const sameStoredProject = (left: PersistedProjectState, right: PersistedProjectState) => left.projectName === right.projectName && left.sequence === right.sequence && left.tracks === right.tracks && left.assets === right.assets && left.markers === right.markers && left.snapToFrames === right.snapToFrames && left.mutedTracks === right.mutedTracks && left.lockedTracks === right.lockedTracks
const projectStorage: PersistStorage<PersistedProjectState> = {
  getItem(name) {
    try {
      const raw = localStorage.getItem(name)
      if (!raw) { lastStoredProject = null; publishSaveStatus('unsaved'); return null }
      const value = JSON.parse(raw) as { state: PersistedProjectState; version?: number }
      lastStoredProject = value.state
      publishSaveStatus('saved')
      return value
    } catch { lastStoredProject = null; publishSaveStatus('error'); return null }
  },
  setItem(name, value) {
    if (lastStoredProject && sameStoredProject(lastStoredProject, value.state)) return
    publishSaveStatus('saving')
    try {
      localStorage.setItem(name, JSON.stringify(value))
      lastStoredProject = value.state
      publishSaveStatus('saved')
    } catch { publishSaveStatus('error') }
  },
  removeItem(name) { try { localStorage.removeItem(name); lastStoredProject = null; publishSaveStatus('unsaved') } catch { publishSaveStatus('error') } },
}

export const useEditorStore = create<EditorState>()(persist((set, get) => ({
  projectName: 'Sin título', sequence: { width: 1920, height: 1080, frameRate: 24 },
  tracks: emptyTracks(), assets: [], markers: [], selectedClipId: '', selectedMediaId: null,
  playhead: 0, zoom: 1, playing: false, snapToFrames: true, activeTool: 'select', mutedTracks: [], lockedTracks: [], past: [], future: [],
  setProjectName: (name) => set((state) => { const projectName = name.trim() || 'Sin título'; return projectName === state.projectName ? state : commit(state, { projectName }) }),
  setSequence: (sequence) => set((state) => JSON.stringify(sequence) === JSON.stringify(state.sequence) ? state : commit(state, { sequence: { ...sequence } })),
  setActiveTool: (activeTool) => set({ activeTool }),
  selectClip: (id) => set({ selectedClipId: id, selectedMediaId: null }),
  selectMedia: (id) => set({ selectedMediaId: id, selectedClipId: '' }),
  setPlayhead: (time) => set({ playhead: Math.max(0, time) }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(2.4, zoom)) }),
  setPlaying: (playing) => set({ playing }),
  addAssets: (assets) => set((state) => {
    const known = new Set(state.assets.map((asset) => asset.id))
    const added = assets.filter((asset) => !known.has(asset.id)).map((asset) => ({ ...asset, status: asset.status ?? 'catalog-only' }))
    return added.length ? commit(state, { assets: [...state.assets, ...added] }) : state
  }),
  updateAsset: (assetId, changes) => set((state) => {
    const current = state.assets.find((asset) => asset.id === assetId)
    if (!current || Object.entries(changes).every(([key, value]) => current[key as keyof MediaItem] === value)) return state
    const assets = state.assets.map((asset) => asset.id === assetId ? { ...asset, ...changes } : asset)
    const fps = state.sequence.frameRate
    const nextDuration =
      changes.durationSeconds && changes.durationSeconds > 0
        ? (state.snapToFrames ? Math.round(changes.durationSeconds * fps) / fps : changes.durationSeconds)
        : null
    const shouldUpdateTracks = Boolean(changes.title || nextDuration)
    const tracks = shouldUpdateTracks ? copyTracks(state.tracks).map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.sourceAssetId !== assetId) return clip
        const updatedClip: Clip = { ...clip }
        if (changes.title) updatedClip.title = changes.title
        if (
          nextDuration &&
          nextDuration > 0 &&
          (Math.abs(clip.duration - 6) < 0.08 || Math.abs(clip.duration - 12) < 0.08)
        ) {
          updatedClip.duration = nextDuration
          if (clip.start > 0 && clip.start <= 0.16 && track.clips.length === 1) {
            updatedClip.start = 0
          }
        }
        return updatedClip
      }),
    })) : state.tracks
    return commit(state, { assets, tracks })
  }),
  removeAsset: (assetId) => set((state) => {
    if (!state.assets.some((asset) => asset.id === assetId)) return state
    const removedClipIds = new Set(state.tracks.flatMap((track) => track.clips.filter((clip) => clip.sourceAssetId === assetId).map((clip) => clip.id)))
    const tracks = copyTracks(state.tracks).map((track) => ({ ...track, clips: track.clips.filter((clip) => clip.sourceAssetId !== assetId) }))
    return {
      ...commit(state, { assets: state.assets.filter((asset) => asset.id !== assetId), tracks }),
      selectedMediaId: state.selectedMediaId === assetId ? null : state.selectedMediaId,
      selectedClipId: removedClipIds.has(state.selectedClipId) ? '' : state.selectedClipId,
    }
  }),
  addMedia: (asset, at, trackId) => {
    const kind = asset.type === 'audio' ? 'audio' : 'video'
    let clipId = ''
    set((state) => {
      const requested = trackId ? state.tracks.find((track) => track.id === trackId) : undefined
      let target = requested?.kind === kind && !state.lockedTracks.includes(requested.id) ? requested : undefined
      if (!target) {
        target = state.tracks.find((track) => track.kind === kind && !state.lockedTracks.includes(track.id))
      }
      let tracks = copyTracks(state.tracks)
      if (!target) {
        let num = tracks.filter((t) => t.kind === kind).length + 1
        const prefix = kind === 'video' ? 'v' : 'a'
        while (tracks.some((t) => t.id === `${prefix}${num}`)) num += 1
        target = {
          id: `${prefix}${num}`,
          name: kind === 'video' ? `Vídeo ${String(num).padStart(2, '0')}` : `Audio ${String(num).padStart(2, '0')}`,
          kind,
          clips: [],
        }
        tracks.push(target)
      }
      const latestAsset = state.assets.find((item) => item.id === asset.id) ?? asset
      const resolvedDuration =
        latestAsset.durationSeconds ??
        parseDurationFromDetail(latestAsset.detail) ??
        (kind === 'audio' ? 12 : 6)
      const fps = state.sequence.frameRate
      const duration = Math.max(
        1 / fps,
        state.snapToFrames ? Math.round(resolvedDuration * fps) / fps : resolvedDuration,
      )

      // Auto-adapt sequence format if timeline has no video clips yet and incoming video format is known
      let nextSequence = state.sequence
      const hasExistingVideoClips = state.tracks.some((t) => t.kind === 'video' && t.clips.length > 0)
      if (!hasExistingVideoClips && kind === 'video' && latestAsset.width && latestAsset.height) {
        if (latestAsset.height > latestAsset.width && state.sequence.width > state.sequence.height) {
          nextSequence = { ...state.sequence, width: 1080, height: 1920 }
        } else if (latestAsset.width > latestAsset.height && state.sequence.height > state.sequence.width) {
          nextSequence = { ...state.sequence, width: 1920, height: 1080 }
        }
      }

      clipId = `c${nextClip++}`
      while (tracks.some((track) => track.clips.some((item) => item.id === clipId))) clipId = `c${nextClip++}`
      const clip: Clip = {
        id: clipId,
        title: latestAsset.title,
        sourceAssetId: latestAsset.id,
        start: 0,
        duration,
        color: latestAsset.thumb === 'cliff' ? 'olive' : latestAsset.thumb === 'harbor' ? 'blue' : 'sand',
        thumbnail: latestAsset.thumb,
        kind,
        transform: { x: nextSequence.width / 2, y: nextSequence.height / 2, scaleX: 100, scaleY: 100, rotation: 0 },
        uniformScale: true,
        opacity: 100,
        blendMode: 'normal',
        volume: 100,
        fadeIn: 0,
        fadeOut: 0,
        keyframes: [],
      }
      const rawStart = at ?? (target.clips.length === 0 ? 0 : target.clips.reduce((end, item) => Math.max(end, item.start + item.duration), 0))
      const start = state.snapToFrames ? Math.round(rawStart * fps) / fps : rawStart
      tracks = tracks.map((track) => track.id === target!.id ? { ...track, clips: [...track.clips, { ...clip, start }] } : track)
      return { ...commit(state, { tracks, sequence: nextSequence }), selectedClipId: clip.id, selectedMediaId: null }
    })
    return clipId
  },
  addTextClip: (options) => {
    let clipId = ''
    set((state) => {
      const preset = getTextPreset(options?.presetId)
      const text = (options?.text ?? preset.sampleText).trim() || preset.sampleText
      const duration = Math.max(0.5, options?.duration ?? preset.defaultDuration)
      const fps = state.sequence.frameRate
      const rawStart = options?.at ?? state.playhead ?? 0
      const start = state.snapToFrames ? Math.round(Math.max(0, rawStart) * fps) / fps : Math.max(0, rawStart)

      let tracks = copyTracks(state.tracks)
      let target: Track | undefined
      if (options?.trackId) {
        const req = tracks.find((t) => t.id === options.trackId)
        if (req && req.kind === 'video' && !state.lockedTracks.includes(req.id)) target = req
      }
      if (!target) {
        // Prefer an existing unlocked video track that doesn't overlap at [start, start+duration], or a dedicated text track
        target = tracks.find(
          (t) =>
            t.kind === 'video' &&
            !state.lockedTracks.includes(t.id) &&
            !t.clips.some((c) => start < c.start + c.duration && start + duration > c.start),
        )
      }
      if (!target) {
        // Create a dedicated overlay video track for titles/captions
        let num = tracks.filter((t) => t.kind === 'video').length + 1
        while (tracks.some((t) => t.id === `v${num}`)) num += 1
        const newTrack: Track = { id: `v${num}`, name: `Texto ${String(num).padStart(2, '0')}`, kind: 'video', clips: [] }
        tracks = [...tracks, newTrack]
        target = newTrack
      }

      clipId = `c${nextClip++}`
      while (tracks.some((track) => track.clips.some((item) => item.id === clipId))) clipId = `c${nextClip++}`

      const shortTitle = text.length > 26 ? `${text.slice(0, 26)}…` : text
      const clip: Clip = {
        id: clipId,
        title: shortTitle,
        text,
        textStyle: getDefaultTextStyle(preset.id),
        textAnimation: getDefaultTextAnimation(preset.id),
        start,
        duration,
        color: 'violet',
        thumbnail: 'text-overlay',
        kind: 'video',
        transform: { x: state.sequence.width / 2, y: state.sequence.height / 2, scaleX: 100, scaleY: 100, rotation: 0 },
        uniformScale: true,
        opacity: 100,
        blendMode: 'normal',
        volume: 100,
        fadeIn: 0,
        fadeOut: 0,
        keyframes: [],
      }

      tracks = tracks.map((track) => (track.id === target!.id ? { ...track, clips: [...track.clips, clip] } : track))
      return { ...commit(state, { tracks }), selectedClipId: clip.id, selectedMediaId: null }
    })
    return clipId
  },
  addSubtitleSequence: (entries, options) => {
    let added = 0
    if (!entries.length) return 0
    set((state) => {
      const fps = state.sequence.frameRate
      let tracks = copyTracks(state.tracks)
      // Find or create a dedicated Subtitles track (like CapCut Pro's Captions lane)
      let subTrack = tracks.find(
        (t) =>
          t.kind === 'video' &&
          !state.lockedTracks.includes(t.id) &&
          t.name.toLowerCase().includes('sub'),
      )
      if (!subTrack) {
        let num = tracks.filter((t) => t.kind === 'video').length + 1
        while (tracks.some((t) => t.id === `v${num}`)) num += 1
        subTrack = { id: `v${num}`, name: 'Subtítulos IA', kind: 'video', clips: [] }
        tracks = [...tracks, subTrack]
      }

      const newClips: Clip[] = []
      let lastId = ''
      for (const entry of entries) {
        const cleanText = entry.text.trim()
        if (!cleanText) continue
        const preset = getTextPreset(entry.presetId ?? 'hormozi-karaoke')
        const start = state.snapToFrames ? Math.round(Math.max(0, entry.start) * fps) / fps : Math.max(0, entry.start)
        const duration = Math.max(0.4, state.snapToFrames ? Math.round(entry.duration * fps) / fps : entry.duration)
        let id = `c${nextClip++}`
        while (tracks.some((t) => t.clips.some((c) => c.id === id)) || newClips.some((c) => c.id === id)) id = `c${nextClip++}`
        lastId = id
        added += 1
        newClips.push({
          id,
          title: cleanText.length > 26 ? `${cleanText.slice(0, 26)}…` : cleanText,
          text: cleanText,
          textStyle: getDefaultTextStyle(preset.id),
          textAnimation: getDefaultTextAnimation(preset.id),
          start,
          duration,
          color: 'violet',
          thumbnail: 'text-overlay',
          kind: 'video',
          transform: { x: state.sequence.width / 2, y: state.sequence.height / 2, scaleX: 100, scaleY: 100, rotation: 0 },
          uniformScale: true,
          opacity: 100,
          blendMode: 'normal',
          volume: 100,
          fadeIn: 0,
          fadeOut: 0,
          keyframes: [],
        })
      }
      if (!newClips.length) return state

      // Sort and sanitize durations to eliminate any overlapping subtitles (SOLAPE)
      const sampleTexts = new Set(TEXT_STYLE_PRESETS.map((p) => p.sampleText.toUpperCase()))
      const frameDelta = 1 / fps
      const baseTrackClips = options?.replaceExisting
        ? []
        : (tracks.find((t) => t.id === subTrack!.id)?.clips.filter((c) => !newClips.some((nc) => nc.id === c.id)) ?? [])
      const combinedClips = [...baseTrackClips, ...newClips]
      combinedClips.sort((a, b) => a.start - b.start)

      for (let i = 0; i < combinedClips.length - 1; i++) {
        const cur = combinedClips[i]
        const nxt = combinedClips[i + 1]
        if (nxt.start < cur.start + frameDelta) {
          nxt.start = cur.start + frameDelta
        }
        if (cur.start + cur.duration > nxt.start) {
          const maxDur = Math.max(frameDelta, nxt.start - cur.start)
          cur.duration = state.snapToFrames ? Math.round(maxDur * fps) / fps : maxDur
        }
      }

      tracks = tracks
        .map((t) => {
          if (t.id === subTrack!.id) {
            return { ...t, clips: combinedClips }
          }
          if (options?.replaceExisting) {
            // Also clean up any single sample placeholder text clips on auxiliary text tracks
            return {
              ...t,
              clips: t.clips.filter(
                (c) => !(c.text && sampleTexts.has(c.text.trim().toUpperCase())),
              ),
            }
          }
          return t
        })
        .filter((t) => t.id === 'v1' || t.id === 'a1' || t.id === subTrack!.id || t.clips.length > 0)
      return { ...commit(state, { tracks }), selectedClipId: lastId || state.selectedClipId, selectedMediaId: null }
    })
    return added
  },
  clearAllSubtitles: () => {
    let count = 0
    set((state) => {
      const tracks = copyTracks(state.tracks).map((track) => {
        if (state.lockedTracks.includes(track.id)) return track
        const remainingClips = track.clips.filter((clip) => {
          const isSubtitle =
            clip.text !== undefined ||
            clip.thumbnail === 'text-overlay' ||
            (track.name.toLowerCase().includes('sub') && clip.sourceAssetId === undefined)
          if (isSubtitle) {
            count += 1
            return false
          }
          return true
        })
        return {
          ...track,
          clips: remainingClips,
        }
      })
      if (count === 0) return state
      return {
        ...commit(state, { tracks }),
        selectedClipId: state.selectedClipId && !tracks.some((t) => t.clips.some((c) => c.id === state.selectedClipId)) ? '' : state.selectedClipId,
      }
    })
    return count
  },
  applyPresetToAllSubtitles: (presetId) => {
    let updated = 0
    set((state) => {
      const preset = getTextPreset(presetId)
      const nextStyle = getDefaultTextStyle(preset.id)
      const nextAnim = getDefaultTextAnimation(preset.id)
      const tracks = copyTracks(state.tracks).map((track) => {
        if (state.lockedTracks.includes(track.id)) return track
        const isSubOrTextTrack =
          track.name.toLowerCase().includes('sub') || track.name.toLowerCase().includes('texto')
        if (!isSubOrTextTrack && !track.clips.some((c) => c.text !== undefined)) return track
        return {
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.text === undefined && clip.thumbnail !== 'text-overlay') return clip
            updated += 1
            return {
              ...clip,
              textStyle: { ...nextStyle, positionY: clip.textStyle?.positionY ?? nextStyle.positionY },
              textAnimation: { ...nextAnim },
            }
          }),
        }
      })
      return updated > 0 ? commit(state, { tracks }) : state
    })
    return updated
  },
  calibrateAllSubtitles: (sourceClipId) => {
    let updated = 0
    set((state) => {
      const sourceClip = state.tracks.flatMap((t) => t.clips).find((c) => c.id === sourceClipId)
      if (!sourceClip || (sourceClip.text === undefined && sourceClip.thumbnail !== 'text-overlay')) {
        return state
      }
      const tracks = copyTracks(state.tracks).map((track) => {
        if (state.lockedTracks.includes(track.id)) return track
        return {
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.text === undefined && clip.thumbnail !== 'text-overlay') return clip
            updated += 1
            return {
              ...clip,
              opacity: sourceClip.opacity ?? clip.opacity,
              transform: sourceClip.transform ? { ...sourceClip.transform } : clip.transform,
              textStyle: sourceClip.textStyle ? { ...sourceClip.textStyle } : clip.textStyle,
              textAnimation: sourceClip.textAnimation ? { ...sourceClip.textAnimation } : clip.textAnimation,
            }
          }),
        }
      })
      return updated > 0 ? commit(state, { tracks }) : state
    })
    return updated
  },
  nudgeAllSubtitlesTime: (deltaSeconds) => {
    let updated = 0
    if (!Number.isFinite(deltaSeconds) || Math.abs(deltaSeconds) < 0.001) return 0
    set((state) => {
      const fps = state.sequence.frameRate
      const tracks = copyTracks(state.tracks).map((track) => {
        if (state.lockedTracks.includes(track.id)) return track
        return {
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.text === undefined && clip.thumbnail !== 'text-overlay') return clip
            updated += 1
            const rawStart = Math.max(0, clip.start + deltaSeconds)
            const nextStart = state.snapToFrames ? Math.round(rawStart * fps) / fps : Math.round(rawStart * 100) / 100
            return {
              ...clip,
              start: nextStart,
            }
          }),
        }
      })
      return updated > 0 ? commit(state, { tracks }) : state
    })
    return updated
  },
  autoGenerateSubtitles: (presetId = 'hormozi-karaoke', customScript) => {
    const state = get()
    const mediaClips = state.tracks
      .flatMap((t) => t.clips.filter((c) => c.text === undefined && c.thumbnail !== 'text-overlay'))
      .sort((a, b) => a.start - b.start)
    const totalSeqDuration = Math.max(
      9,
      ...mediaClips.map((c) => c.start + c.duration),
    )
    if (customScript?.trim()) {
      const lines = customScript
        .split(/\r?\n|(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const sliceDur = Math.max(1.8, Math.min(3.4, totalSeqDuration / Math.max(1, lines.length)))
      const entries: SubtitleEntryInput[] = lines.map((line, idx) => ({
        text: line,
        start: Math.round(idx * sliceDur * 100) / 100,
        duration: Math.round((sliceDur - 0.08) * 100) / 100,
        presetId,
      }))
      return get().addSubtitleSequence(entries, { replaceExisting: true })
    }

    const primaryTitle = (mediaClips[0]?.title || state.projectName || 'Secuencia')
      .replace(/\.[a-z0-9]{2,4}$/i, '')
      .replace(/[_-]+/g, ' ')
      .trim()
    const segmentStep = 2.6
    const segmentCount = Math.max(4, Math.round(totalSeqDuration / segmentStep))
    const actualStep = totalSeqDuration / segmentCount
    const defaultPool = [
      primaryTitle.toUpperCase(),
      'Cada plano construye el pulso narrativo de la escena',
      'El sonido marca la entrada de cada transición visual',
      'La atmósfera se desarrolla siguiendo la cadencia de la voz',
      'Observa cómo cambia la tensión en este punto del relato',
      'Un corte limpio mantiene la atención en el mensaje central',
      'La progresión visual acompaña el ritmo de la locución',
      'Cada pausa en el audio respira antes de la siguiente idea',
    ]
    const entries: SubtitleEntryInput[] = Array.from({ length: segmentCount }, (_, idx) => ({
      text: defaultPool[idx % defaultPool.length],
      start: Math.round(idx * actualStep * 100) / 100,
      duration: Math.round(Math.max(0.8, actualStep - 0.08) * 100) / 100,
      presetId,
    }))
    return get().addSubtitleSequence(entries, { replaceExisting: true })
  },
  updateClip: (clipId, changes) => set((state) => {
    const owner = state.tracks.find((track) => track.clips.some((clip) => clip.id === clipId))
    if (!owner || state.lockedTracks.includes(owner.id)) return state
    const tracks = copyTracks(state.tracks).map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== clipId) return clip
        const nextTitle =
          changes.text !== undefined && changes.title === undefined
            ? changes.text.trim().slice(0, 26) || clip.title
            : (changes.title ?? clip.title)
        return {
          ...clip,
          ...changes,
          title: nextTitle,
          transform: changes.transform ? { ...changes.transform } : clip.transform,
          textStyle: changes.textStyle ? { ...changes.textStyle } : clip.textStyle,
          textAnimation: changes.textAnimation ? { ...changes.textAnimation } : clip.textAnimation,
        }
      }),
    }))
    return JSON.stringify(tracks) === JSON.stringify(state.tracks) ? state : commit(state, { tracks }, `clip:${clipId}:${Object.keys(changes).sort().join(',')}`)
  }),
  moveClip: (clipId, start, duration) => set((state) => {
    const owner = state.tracks.find((track) => track.clips.some((clip) => clip.id === clipId))
    if (!owner || state.lockedTracks.includes(owner.id)) return state
    const tracks = copyTracks(state.tracks).map((track) => ({ ...track, clips: track.clips.map((clip) => clip.id === clipId ? { ...clip, start: Math.max(0, start), ...(duration === undefined ? {} : { duration: Math.max(1 / state.sequence.frameRate, duration) }) } : clip) }))
    return JSON.stringify(tracks) === JSON.stringify(state.tracks) ? state : commit(state, { tracks })
  }),
  moveClipToNewTrack: (clipId) => set((state) => {
    const source = state.tracks.find((track) => track.clips.some((clip) => clip.id === clipId))
    const clip = source?.clips.find((item) => item.id === clipId)
    if (!source || !clip || state.lockedTracks.includes(source.id)) return state
    const prefix = source.kind === 'video' ? 'v' : 'a'
    let number = state.tracks.filter((track) => track.kind === source.kind).length + 1
    while (state.tracks.some((track) => track.id === `${prefix}${number}`)) number += 1
    const newTrack: Track = { id: `${prefix}${number}`, name: `${source.kind === 'video' ? 'Video' : 'Audio'} ${String(number).padStart(2, '0')}`, kind: source.kind, clips: [clip] }
    const tracks = copyTracks(state.tracks).map((track) => track.id === source.id ? { ...track, clips: track.clips.filter((item) => item.id !== clipId) } : track)
    return { ...commit(state, { tracks: [...tracks, newTrack] }), selectedClipId: clipId }
  }),
  splitClip: (clipId, time) => set((state) => {
    const track = state.tracks.find((item) => item.clips.some((clip) => clip.id === clipId))
    const clip = track?.clips.find((item) => item.id === clipId)
    if (!track || !clip || state.lockedTracks.includes(track.id)) return state
    const fps = state.sequence.frameRate
    const splitAt = Math.floor(time * fps) / fps
    const offset = splitAt - clip.start
    if (offset < 1 / fps || offset > clip.duration - 1 / fps) return state
    let rightId = `c${nextClip++}`
    while (state.tracks.some((item) => item.clips.some((candidate) => candidate.id === rightId))) rightId = `c${nextClip++}`
    const right: Clip = { ...clip, id: rightId, start: splitAt, duration: clip.duration - offset }
    const tracks = copyTracks(state.tracks).map((item) => item.id === track.id ? { ...item, clips: item.clips.flatMap((candidate) => candidate.id === clipId ? [{ ...candidate, duration: offset }, right] : [candidate]) } : item)
    return { ...commit(state, { tracks }), selectedClipId: right.id }
  }),
  deleteClip: (clipId) => set((state) => {
    const owner = state.tracks.find((track) => track.clips.some((clip) => clip.id === clipId))
    if (!owner || state.lockedTracks.includes(owner.id)) return state
    const tracks = copyTracks(state.tracks).map((track) => ({ ...track, clips: track.clips.filter((clip) => clip.id !== clipId) }))
    return JSON.stringify(tracks) === JSON.stringify(state.tracks) ? state : { ...commit(state, { tracks }), selectedClipId: state.selectedClipId === clipId ? '' : state.selectedClipId }
  }),
  duplicateClip: (clipId) => {
    let duplicatedId = ''
    set((state) => {
      const owner = state.tracks.find((track) => track.clips.some((clip) => clip.id === clipId))
      const sourceClip = owner?.clips.find((clip) => clip.id === clipId)
      if (!owner || !sourceClip || state.lockedTracks.includes(owner.id)) return state
      let newId = `c${nextClip++}`
      while (state.tracks.some((track) => track.clips.some((item) => item.id === newId))) newId = `c${nextClip++}`
      duplicatedId = newId
      const rawStart = sourceClip.start + sourceClip.duration
      const start = state.snapToFrames ? Math.round(rawStart * state.sequence.frameRate) / state.sequence.frameRate : rawStart
      const shift = start - sourceClip.start
      const copy: Clip = {
        ...sourceClip,
        id: newId,
        start,
        transform: sourceClip.transform ? { ...sourceClip.transform } : undefined,
        textStyle: sourceClip.textStyle ? { ...sourceClip.textStyle } : undefined,
        textAnimation: sourceClip.textAnimation ? { ...sourceClip.textAnimation } : undefined,
        keyframes: sourceClip.keyframes?.map((kf) => ({ ...kf, time: Math.round((kf.time + shift) * 1000) / 1000 })),
      }
      const tracks = copyTracks(state.tracks).map((track) => track.id === owner.id ? { ...track, clips: [...track.clips, copy] } : track)
      return { ...commit(state, { tracks }), selectedClipId: newId }
    })
    return duplicatedId
  },
  ripplePackTrack: (trackId) => {
    let movedCount = 0
    set((state) => {
      const fps = state.sequence.frameRate
      const tracks = copyTracks(state.tracks).map((track) => {
        if (state.lockedTracks.includes(track.id)) return track
        if (trackId && track.id !== trackId) return track
        if (!track.clips.length) return track
        let cursor = 0
        const sorted = [...track.clips].sort((a, b) => a.start - b.start)
        const packed = sorted.map((clip) => {
          const nextStart = state.snapToFrames ? Math.round(cursor * fps) / fps : cursor
          const delta = nextStart - clip.start
          if (Math.abs(delta) > 0.001) movedCount += 1
          cursor = nextStart + clip.duration
          return {
            ...clip,
            start: nextStart,
            keyframes: clip.keyframes?.map((kf) => ({ ...kf, time: Math.max(0, Math.round((kf.time + delta) * 1000) / 1000) })),
          }
        })
        return { ...track, clips: packed }
      })
      return movedCount > 0 ? commit(state, { tracks }) : state
    })
    return movedCount
  },
  autoAudioBalance: () => {
    let updatedCount = 0
    set((state) => {
      const audioTracks = state.tracks.filter((t) => t.kind === 'audio')
      const tracks = copyTracks(state.tracks).map((track) => {
        if (state.lockedTracks.includes(track.id) || !track.clips.length) return track
        const isSecondaryAudio = track.kind === 'audio' && audioTracks.findIndex((t) => t.id === track.id) > 0
        const targetVol = track.kind === 'audio' ? (isSecondaryAudio ? 68 : 96) : 100
        const clips = track.clips.map((clip) => {
          const fade = Math.min(0.4, Math.max(0.1, Math.round(clip.duration * 0.12 * 10) / 10))
          if (clip.volume === targetVol && clip.fadeIn === fade && clip.fadeOut === fade) return clip
          updatedCount += 1
          return { ...clip, volume: targetVol, fadeIn: fade, fadeOut: fade }
        })
        return { ...track, clips }
      })
      return updatedCount > 0 ? commit(state, { tracks }) : state
    })
    return updatedCount
  },
  autoSceneMarkers: () => {
    let addedCount = 0
    set((state) => {
      const fps = state.sequence.frameRate
      const cutTimes = new Set<number>()
      for (const track of state.tracks) {
        if (track.kind !== 'video') continue
        for (const clip of track.clips) {
          const start = state.snapToFrames ? Math.round(clip.start * fps) / fps : clip.start
          cutTimes.add(Math.round(start * 100) / 100)
        }
      }
      const existingTimes = new Set(state.markers.map((m) => Math.round(m.time * 100) / 100))
      const sortedCuts = [...cutTimes].sort((a, b) => a - b).filter((time) => !existingTimes.has(time))
      if (!sortedCuts.length) return state
      const newMarkers: TimelineMarker[] = sortedCuts.map((time, idx) => {
        let number = nextMarker++
        while (state.markers.some((item) => item.id === `m${number}`) || idx < 0) number = nextMarker++
        const label = time === 0 ? 'Inicio' : `Escena ${String(idx + 1).padStart(2, '0')}`
        addedCount += 1
        return { id: `m${number}`, time, label }
      })
      return commit(state, { markers: [...state.markers, ...newMarkers] })
    })
    return addedCount
  },
  addMarker: (time, customLabel) => set((state) => {
    let number = nextMarker++
    while (state.markers.some((item) => item.id === `m${number}`)) number = nextMarker++
    const markerTime = state.snapToFrames ? Math.round(Math.max(0, time) * state.sequence.frameRate) / state.sequence.frameRate : Math.max(0, time)
    const marker: TimelineMarker = { id: `m${number}`, time: markerTime, label: customLabel || `Marker ${number}` }
    return commit(state, { markers: [...state.markers, marker] })
  }),
  removeMarker: (markerId) => set((state) => {
    const markers = state.markers.filter((marker) => marker.id !== markerId)
    return markers.length === state.markers.length ? state : commit(state, { markers })
  }),
  toggleSnap: () => set((state) => commit(state, { snapToFrames: !state.snapToFrames })),
  addTrack: (kind) => set((state) => {
    const prefix = kind === 'video' ? 'v' : 'a'
    let number = state.tracks.filter((track) => track.kind === kind).length + 1
    while (state.tracks.some((track) => track.id === `${prefix}${number}`)) number += 1
    const track: Track = { id: `${prefix}${number}`, name: `${kind === 'video' ? 'Video' : 'Audio'} ${String(number).padStart(2, '0')}`, kind, clips: [] }
    return commit(state, { tracks: [...copyTracks(state.tracks), track] })
  }),
  toggleMute: (id) => set((state) => commit(state, { mutedTracks: state.mutedTracks.includes(id) ? state.mutedTracks.filter((trackId) => trackId !== id) : [...state.mutedTracks, id] })),
  toggleLock: (id) => set((state) => commit(state, { lockedTracks: state.lockedTracks.includes(id) ? state.lockedTracks.filter((trackId) => trackId !== id) : [...state.lockedTracks, id] })),
  undo: () => set((state) => {
    lastHistoryGroup = null
    const previous = state.past.at(-1)
    return previous ? { ...applySnapshot(previous), past: state.past.slice(0, -1), future: [snapshot(state), ...state.future] } : state
  }),
  redo: () => set((state) => {
    lastHistoryGroup = null
    const next = state.future[0]
    return next ? { ...applySnapshot(next), past: [...state.past, snapshot(state)], future: state.future.slice(1) } : state
  }),
  loadProject: (project) => set({
    projectName: project.projectName,
    sequence: { ...project.sequence },
    tracks: copyTracks(project.tracks),
    assets: project.assets.map((asset) => ({ ...asset })),
    markers: copyMarkers(project.markers),
    snapToFrames: project.snapToFrames ?? true,
    mutedTracks: [...(project.mutedTracks ?? [])],
    lockedTracks: [...(project.lockedTracks ?? [])],
    selectedClipId: '',
    selectedMediaId: null,
    playhead: 0,
    playing: false,
    past: [],
    future: [],
  }),
  resetProject: () => set({
    projectName: 'Sin título',
    sequence: { width: 1920, height: 1080, frameRate: 24 },
    tracks: emptyTracks(),
    assets: [],
    markers: [],
    selectedClipId: '',
    selectedMediaId: null,
    playhead: 0,
    playing: false,
    past: [],
    future: [],
  }),
}), {
  name: 'sparta-video-project-v1', storage: projectStorage, version: 5,
  migrate: (persisted) => normalizeLegacyMediaTypes(cleanSeededProject(persisted as PersistedProjectState)),
  partialize: (state) => ({ projectName: state.projectName, sequence: state.sequence, tracks: state.tracks, assets: state.assets, markers: state.markers, snapToFrames: state.snapToFrames, mutedTracks: state.mutedTracks, lockedTracks: state.lockedTracks }),
}))

// Remove the untouched sample workspace from an already-running browser session as well as on migration.
const loadedState = useEditorStore.getState()
const cleanedLoadedState = cleanSeededProject(loadedState)
const normalizedLoadedState = normalizeLegacyMediaTypes(cleanedLoadedState)
if (normalizedLoadedState !== loadedState) {
  useEditorStore.setState({
    ...loadedState,
    ...normalizedLoadedState,
    ...(cleanedLoadedState !== loadedState ? { selectedClipId: '', selectedMediaId: null, playhead: 0, past: [], future: [] } : {}),
  })
}

