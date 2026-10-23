import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'
import { demoMedia, demoTracks } from './model'
import type { Clip, MediaItem, SequenceSettings, TimelineMarker, Track } from './model'

type ProjectSnapshot = Pick<EditorState, 'projectName' | 'sequence' | 'tracks' | 'assets' | 'markers' | 'snapToFrames' | 'mutedTracks' | 'lockedTracks' | 'selectedClipId' | 'selectedMediaId'>
type EditorState = {
  projectName: string; sequence: SequenceSettings; tracks: Track[]; assets: MediaItem[]; markers: TimelineMarker[]
  selectedClipId: string; selectedMediaId: string | null; playhead: number; zoom: number; playing: boolean; snapToFrames: boolean
  activeTool: 'select' | 'razor'
  mutedTracks: string[]; lockedTracks: string[]; past: ProjectSnapshot[]; future: ProjectSnapshot[]
  setProjectName: (name: string) => void; setSequence: (sequence: SequenceSettings) => void
  setActiveTool: (tool: 'select' | 'razor') => void
  selectClip: (id: string) => void; selectMedia: (id: string) => void; setPlayhead: (time: number) => void
  setZoom: (zoom: number) => void; setPlaying: (playing: boolean) => void; addAssets: (assets: MediaItem[]) => void
  addMedia: (asset: MediaItem, at?: number, trackId?: string) => string; updateClip: (clipId: string, changes: Partial<Clip>) => void
  moveClip: (clipId: string, start: number, duration?: number) => void; splitClip: (clipId: string, time: number) => void
  deleteClip: (clipId: string) => void; addMarker: (time: number) => void; removeMarker: (markerId: string) => void; toggleSnap: () => void; addTrack: (kind: 'video' | 'audio') => void
  toggleMute: (id: string) => void; toggleLock: (id: string) => void; undo: () => void; redo: () => void
}
type PersistedProjectState = Pick<EditorState, 'projectName' | 'sequence' | 'tracks' | 'assets' | 'markers' | 'snapToFrames' | 'mutedTracks' | 'lockedTracks'>

let nextClip = 10
let nextMarker = 1
let lastHistoryGroup: string | null = null
let lastHistoryGroupAt = 0
const copyTracks = (tracks: Track[]) => tracks.map((track) => ({ ...track, clips: track.clips.map((clip) => ({ ...clip, transform: clip.transform ? { ...clip.transform } : undefined, keyframes: clip.keyframes?.map((keyframe) => ({ ...keyframe })) })) }))
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

export const useEditorStore = create<EditorState>()(persist((set) => ({
  projectName: 'Coastal film', sequence: { width: 1920, height: 1080, frameRate: 24 },
  tracks: copyTracks(demoTracks), assets: [...demoMedia], markers: [], selectedClipId: 'c2', selectedMediaId: null,
  playhead: 8.8, zoom: 1, playing: false, snapToFrames: true, activeTool: 'select', mutedTracks: [], lockedTracks: [], past: [], future: [],
  setProjectName: (name) => set((state) => { const projectName = name.trim() || 'Untitled project'; return projectName === state.projectName ? state : commit(state, { projectName }) }),
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
  addMedia: (asset, at, trackId) => {
    const kind = asset.type === 'audio' ? 'audio' : 'video'
    let clipId = ''
    set((state) => {
      const requested = trackId ? state.tracks.find((track) => track.id === trackId) : undefined
      const target = requested?.kind === kind && !state.lockedTracks.includes(requested.id) ? requested : trackId ? undefined : state.tracks.find((track) => track.kind === kind && !state.lockedTracks.includes(track.id))
      if (!target) return state
      clipId = `c${nextClip++}`
      while (state.tracks.some((track) => track.clips.some((item) => item.id === clipId))) clipId = `c${nextClip++}`
      const clip: Clip = { id: clipId, title: asset.title, start: 0, duration: kind === 'audio' ? 12 : 6, color: asset.thumb === 'cliff' ? 'olive' : asset.thumb === 'harbor' ? 'blue' : 'sand', thumbnail: asset.thumb, kind, transform: { x: state.sequence.width / 2, y: state.sequence.height / 2, scaleX: 100, scaleY: 100, rotation: 0 }, uniformScale: true, opacity: 100, blendMode: 'normal', volume: 100, fadeIn: 0, fadeOut: 0, keyframes: [] }
      const rawStart = at ?? target.clips.reduce((end, item) => Math.max(end, item.start + item.duration), 0) + 0.15
      const start = state.snapToFrames ? Math.round(rawStart * state.sequence.frameRate) / state.sequence.frameRate : rawStart
      const tracks = copyTracks(state.tracks).map((track) => track.id === target.id ? { ...track, clips: [...track.clips, { ...clip, start }] } : track)
      return { ...commit(state, { tracks }), selectedClipId: clip.id, selectedMediaId: null }
    })
    return clipId
  },
  updateClip: (clipId, changes) => set((state) => {
    const owner = state.tracks.find((track) => track.clips.some((clip) => clip.id === clipId))
    if (!owner || state.lockedTracks.includes(owner.id)) return state
    const tracks = copyTracks(state.tracks).map((track) => ({ ...track, clips: track.clips.map((clip) => clip.id === clipId ? { ...clip, ...changes, transform: changes.transform ? { ...changes.transform } : clip.transform } : clip) }))
    return JSON.stringify(tracks) === JSON.stringify(state.tracks) ? state : commit(state, { tracks }, `clip:${clipId}:${Object.keys(changes).sort().join(',')}`)
  }),
  moveClip: (clipId, start, duration) => set((state) => {
    const owner = state.tracks.find((track) => track.clips.some((clip) => clip.id === clipId))
    if (!owner || state.lockedTracks.includes(owner.id)) return state
    const tracks = copyTracks(state.tracks).map((track) => ({ ...track, clips: track.clips.map((clip) => clip.id === clipId ? { ...clip, start: Math.max(0, start), ...(duration === undefined ? {} : { duration: Math.max(1 / state.sequence.frameRate, duration) }) } : clip) }))
    return JSON.stringify(tracks) === JSON.stringify(state.tracks) ? state : commit(state, { tracks })
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
  addMarker: (time) => set((state) => {
    let number = nextMarker++
    while (state.markers.some((item) => item.id === `m${number}`)) number = nextMarker++
    const markerTime = state.snapToFrames ? Math.round(Math.max(0, time) * state.sequence.frameRate) / state.sequence.frameRate : Math.max(0, time)
    const marker: TimelineMarker = { id: `m${number}`, time: markerTime, label: `Marker ${number}` }
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
}), { name: 'sparta-video-project-v1', storage: projectStorage, partialize: (state) => ({ projectName: state.projectName, sequence: state.sequence, tracks: state.tracks, assets: state.assets, markers: state.markers, snapToFrames: state.snapToFrames, mutedTracks: state.mutedTracks, lockedTracks: state.lockedTracks }) }))

