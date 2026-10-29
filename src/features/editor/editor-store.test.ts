import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getProjectSaveStatus, useEditorStore } from './editor-store'
import { demoMedia, demoTracks } from './editor-store.fixtures'

describe('editor project operations', () => {
  afterEach(() => vi.restoreAllMocks())
  beforeEach(() => {
    localStorage.removeItem('sparta-video-project-v1')
    useEditorStore.setState({ projectName: 'Coastal film', sequence: { width: 1920, height: 1080, frameRate: 24 }, tracks: demoTracks, assets: demoMedia, markers: [], selectedClipId: 'c2', selectedMediaId: null, snapToFrames: true, activeTool: 'select', playhead: 8.8, zoom: 1, playing: false, mutedTracks: [], lockedTracks: [], past: [], future: [] })
  })

  it('splits a clip on a frame and undoes the whole operation', () => {
    const store = useEditorStore.getState()
    store.splitClip('c1', 4)
    const afterSplit = useEditorStore.getState().tracks[0].clips
    expect(afterSplit).toHaveLength(4)
    expect(afterSplit.find((clip) => clip.id === 'c1')?.duration).toBe(4)
    expect(afterSplit[1].start).toBe(4)
    const rightId = afterSplit[1].id
    expect(useEditorStore.getState().selectedClipId).toBe(rightId)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().tracks[0].clips).toHaveLength(3)
    expect(useEditorStore.getState().tracks[0].clips[0].duration).toBe(7.4)
    expect(useEditorStore.getState().selectedClipId).toBe('c2')
    useEditorStore.getState().redo()
    expect(useEditorStore.getState().selectedClipId).toBe(rightId)
  })

  it('stores and reverses a marker at the playhead', () => {
    useEditorStore.getState().addMarker(5.25)
    expect(useEditorStore.getState().markers[0].time).toBe(5.25)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().markers).toHaveLength(0)
    useEditorStore.getState().redo()
    expect(useEditorStore.getState().markers[0].time).toBe(5.25)
  })

  it('updates canonical clip properties and includes them in undo history', () => {
    useEditorStore.getState().updateClip('c2', { opacity: 65, transform: { x: 800, y: 420, scaleX: 120, scaleY: 120, rotation: 5 } })
    expect(useEditorStore.getState().tracks[0].clips.find((clip) => clip.id === 'c2')?.opacity).toBe(65)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().tracks[0].clips.find((clip) => clip.id === 'c2')?.opacity).toBeUndefined()
  })

  it('coalesces a continuous inspector property gesture into one undo step', () => {
    useEditorStore.getState().updateClip('c2', { opacity: 72 })
    useEditorStore.getState().updateClip('c2', { opacity: 41 })
    expect(useEditorStore.getState().past).toHaveLength(1)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().tracks[0].clips.find((clip) => clip.id === 'c2')?.opacity).toBeUndefined()
    useEditorStore.getState().updateClip('c2', { opacity: 20 })
    expect(useEditorStore.getState().past).toHaveLength(1)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().tracks[0].clips.find((clip) => clip.id === 'c2')?.opacity).toBeUndefined()
    useEditorStore.getState().redo()
    expect(useEditorStore.getState().tracks[0].clips.find((clip) => clip.id === 'c2')?.opacity).toBe(20)
  })

  it('saves project data in browser storage while keeping playback UI state transient', () => {
    useEditorStore.getState().setProjectName('North shore')
    useEditorStore.getState().setPlaying(true)
    const saved = JSON.parse(localStorage.getItem('sparta-video-project-v1') ?? '{}').state
    expect(saved.projectName).toBe('North shore')
    expect(saved.playing).toBeUndefined()
    expect(getProjectSaveStatus()).toBe('saved')
  })

  it('reports a storage error instead of claiming the project was saved', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Storage quota exceeded', 'QuotaExceededError') })
    useEditorStore.getState().setProjectName('Unsaved edit')
    expect(getProjectSaveStatus()).toBe('error')
  })

  it('does not rewrite local storage for playhead and playback-only updates', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem')
    useEditorStore.getState().setProjectName('Temporary name')
    useEditorStore.getState().setProjectName('Coastal film')
    write.mockClear()
    useEditorStore.getState().setPlayhead(3)
    useEditorStore.getState().setPlaying(true)
    useEditorStore.getState().setZoom(1.2)
    useEditorStore.getState().setPlayhead(4)
    expect(write).not.toHaveBeenCalled()
    useEditorStore.getState().updateClip('c2', { opacity: 55 })
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('allows seeking past the original demo duration as the sequence grows', () => {
    useEditorStore.getState().setPlayhead(42)
    expect(useEditorStore.getState().playhead).toBe(42)
  })

  it('keeps move and trim history exact and uses the sequence frame rate for minimum duration', () => {
    useEditorStore.getState().setSequence({ width: 1920, height: 1080, frameRate: 60 })
    useEditorStore.getState().moveClip('c1', 2, 0.001)
    const moved = useEditorStore.getState().tracks[0].clips[0]
    expect(moved.start).toBe(2)
    expect(moved.duration).toBeCloseTo(1 / 60)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().tracks[0].clips[0].start).toBe(0)
    expect(useEditorStore.getState().tracks[0].clips[0].duration).toBe(7.4)
    useEditorStore.getState().redo()
    expect(useEditorStore.getState().tracks[0].clips[0].duration).toBeCloseTo(1 / 60)
  })

  it('allows markers beyond the demo fixtures and undoes track additions', () => {
    useEditorStore.getState().addMarker(45)
    expect(useEditorStore.getState().markers[0].time).toBe(45)
    useEditorStore.getState().addTrack('video')
    expect(useEditorStore.getState().tracks).toHaveLength(4)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().tracks).toHaveLength(3)
    expect(useEditorStore.getState().markers[0].time).toBe(45)
  })

  it('snaps inserted markers and media to sequence frames only while snap is enabled', () => {
    useEditorStore.getState().addMarker(5.257)
    expect(useEditorStore.getState().markers[0].time).toBe(5.25)
    const snappedId = useEditorStore.getState().addMedia(demoMedia[0], 1.01)
    expect(useEditorStore.getState().tracks[0].clips.find((clip) => clip.id === snappedId)?.start).toBe(1)
    useEditorStore.getState().toggleSnap()
    useEditorStore.getState().addMarker(6.257)
    expect(useEditorStore.getState().markers[1].time).toBe(6.257)
    const id = useEditorStore.getState().addMedia(demoMedia[0], 1.01)
    expect(useEditorStore.getState().tracks[0].clips.find((clip) => clip.id === id)?.start).toBe(1.01)
  })

  it('undoes sequence, project name, snapping and track state from project snapshots', () => {
    const store = useEditorStore.getState()
    store.setSequence({ width: 1080, height: 1920, frameRate: 30 })
    store.setProjectName('Vertical cut')
    store.toggleSnap()
    store.toggleMute('a1')
    expect(useEditorStore.getState()).toMatchObject({ projectName: 'Vertical cut', sequence: { width: 1080, frameRate: 30 }, snapToFrames: false, mutedTracks: ['a1'] })
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().mutedTracks).toEqual([])
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().snapToFrames).toBe(true)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().projectName).toBe('Coastal film')
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().sequence).toEqual({ width: 1920, height: 1080, frameRate: 24 })
    useEditorStore.getState().redo()
    expect(useEditorStore.getState().sequence.frameRate).toBe(30)
  })

  it('enforces locked tracks in core edit commands and routes new media to an unlocked track', () => {
    useEditorStore.getState().toggleLock('v1')
    const historyAfterLock = useEditorStore.getState().past.length
    useEditorStore.getState().moveClip('c1', 10)
    useEditorStore.getState().updateClip('c1', { opacity: 20 })
    useEditorStore.getState().splitClip('c1', 2)
    useEditorStore.getState().deleteClip('c1')
    expect(useEditorStore.getState().tracks[0].clips).toHaveLength(3)
    expect(useEditorStore.getState().tracks[0].clips[0]).toMatchObject({ start: 0, duration: 7.4 })
    expect(useEditorStore.getState().past).toHaveLength(historyAfterLock)
    const newClipId = useEditorStore.getState().addMedia(demoMedia[0], 1)
    expect(useEditorStore.getState().tracks[1].clips.some((clip) => clip.id === newClipId)).toBe(true)
  })

  it('duplicates a clip, packs gaps, auto-balances audio, and generates scene markers', () => {
    const store = useEditorStore.getState()
    const dupId = store.duplicateClip('c1')
    expect(dupId).toBeTruthy()
    expect(useEditorStore.getState().tracks[0].clips.some((clip) => clip.id === dupId)).toBe(true)

    const packed = useEditorStore.getState().ripplePackTrack('v1')
    expect(packed).toBeGreaterThanOrEqual(1)

    const markersAdded = useEditorStore.getState().autoSceneMarkers()
    expect(markersAdded).toBeGreaterThanOrEqual(1)

    const audioUpdated = useEditorStore.getState().autoAudioBalance()
    expect(audioUpdated).toBeGreaterThanOrEqual(1)
  })

  it('adds animated CapCut Pro text clips and generates synchronized subtitle tracks with full undo support', () => {
    const store = useEditorStore.getState()
    const textClipId = store.addTextClip({
      text: 'EL SECRETO DEL MONTAJE',
      presetId: 'hormozi-karaoke',
      at: 2.0,
      duration: 3.0,
    })
    expect(textClipId).toBeTruthy()
    const addedClip = useEditorStore.getState().tracks.flatMap((t) => t.clips).find((c) => c.id === textClipId)
    expect(addedClip?.text).toBe('EL SECRETO DEL MONTAJE')
    expect(addedClip?.textStyle?.presetId).toBe('hormozi-karaoke')
    expect(addedClip?.textAnimation?.in).toBe('karaoke')

    const generatedCount = useEditorStore.getState().autoGenerateSubtitles(
      'capcut-pop-pill',
      'Primera línea de impacto\nSegunda línea dinámica\nTercera línea final',
    )
    expect(generatedCount).toBe(3)
    const subTrack = useEditorStore.getState().tracks.find((t) => t.name === 'Subtítulos IA')
    expect(subTrack?.clips.length).toBeGreaterThanOrEqual(3)

    useEditorStore.getState().undo()
    const afterUndo = useEditorStore.getState().tracks.flatMap((t) => t.clips)
    expect(afterUndo.some((c) => c.text === 'Primera línea de impacto')).toBe(false)
  })
})
