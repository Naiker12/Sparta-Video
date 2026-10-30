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

  it('clears all subtitles and text clips in one operation with full undo and redo support', () => {
    const store = useEditorStore.getState()
    // Generate some subtitles
    const count = store.autoGenerateSubtitles(
      'capcut-pop-pill',
      'Línea uno\nLínea dos\nLínea tres\nLínea cuatro',
    )
    expect(count).toBe(4)

    // Add another custom text clip
    store.addTextClip({
      text: 'Texto suelto',
      at: 1.0,
      duration: 2.0,
    })

    const totalClipsBefore = useEditorStore.getState().tracks.flatMap((t) => t.clips).length
    const cleared = useEditorStore.getState().clearAllSubtitles()
    expect(cleared).toBeGreaterThanOrEqual(5)

    const clipsAfter = useEditorStore.getState().tracks.flatMap((t) => t.clips)
    expect(clipsAfter.length).toBe(totalClipsBefore - cleared)
    expect(clipsAfter.some((c) => c.text !== undefined)).toBe(false)
    expect(clipsAfter.some((c) => c.thumbnail === 'text-overlay')).toBe(false)

    // Test Undo restores all cleared subtitles
    useEditorStore.getState().undo()
    const clipsRestored = useEditorStore.getState().tracks.flatMap((t) => t.clips)
    expect(clipsRestored.length).toBe(totalClipsBefore)
    expect(clipsRestored.some((c) => c.text === 'Línea uno')).toBe(true)

    // Test Redo clears them again
    useEditorStore.getState().redo()
    const clipsRedone = useEditorStore.getState().tracks.flatMap((t) => t.clips)
    expect(clipsRedone.length).toBe(totalClipsBefore - cleared)

    // Running on empty returns 0 without pushing new history
    const pastLength = useEditorStore.getState().past.length
    const emptyClear = useEditorStore.getState().clearAllSubtitles()
    expect(emptyClear).toBe(0)
    expect(useEditorStore.getState().past.length).toBe(pastLength)
  })

  it('setSequence from 1920x1080 to 1080x1920 rescales clip transforms and position keyframes proportionally', () => {
    const store = useEditorStore.getState()
    // Prepare a clip with transform and position keyframe
    store.updateClip('c1', {
      transform: { x: 960, y: 540, scaleX: 100, scaleY: 100, rotation: 0 },
      keyframes: [
        { property: 'position', time: 0, valueX: 960, valueY: 540 },
        { property: 'position', time: 2, valueX: 480, valueY: 270 },
      ],
    })

    const initialPastLength = useEditorStore.getState().past.length

    // Change sequence to vertical 9:16 (1080x1920)
    store.setSequence({ width: 1080, height: 1920, frameRate: 24 })

    const updatedClip = useEditorStore.getState().tracks[0].clips.find((c) => c.id === 'c1')
    expect(updatedClip?.transform?.x).toBe(540)
    expect(updatedClip?.transform?.y).toBe(960)

    const kf0 = updatedClip?.keyframes?.find((k) => k.time === 0 && k.property === 'position')
    expect(kf0?.valueX).toBe(540)
    expect(kf0?.valueY).toBe(960)

    const kf1 = updatedClip?.keyframes?.find((k) => k.time === 2 && k.property === 'position')
    expect(kf1?.valueX).toBe(270)
    expect(kf1?.valueY).toBe(480)

    // A single undo reverts both the sequence dimensions and clip transforms
    expect(useEditorStore.getState().past.length).toBe(initialPastLength + 1)
    useEditorStore.getState().undo()

    expect(useEditorStore.getState().sequence).toEqual({ width: 1920, height: 1080, frameRate: 24 })
    const revertedClip = useEditorStore.getState().tracks[0].clips.find((c) => c.id === 'c1')
    expect(revertedClip?.transform?.x).toBe(960)
    expect(revertedClip?.transform?.y).toBe(540)
  })

  it('regression: clip created in 16:9 and sequence adapted to 9:16 has 0 offset from center', () => {
    const store = useEditorStore.getState()
    // Default 1920x1080 sequence
    expect(store.sequence.width).toBe(1920)
    expect(store.sequence.height).toBe(1080)

    const clipId = store.addMedia({
      id: 'vertical-video-asset',
      title: 'phone_recording.mp4',
      detail: 'VIDEO · 1080×1920',
      thumb: 'cliff',
      type: 'video',
      status: 'ready',
      width: 1080,
      height: 1920,
    })

    // User clicks "Adapt sequence" -> 1080x1920
    store.setSequence({ width: 1080, height: 1920, frameRate: 24 })

    const updatedState = useEditorStore.getState()
    const adaptedClip = updatedState.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId)
    expect(adaptedClip).toBeDefined()
    expect(adaptedClip?.transform?.x).toBe(540)
    expect(adaptedClip?.transform?.y).toBe(960)

    // Center offset calculation in PreviewMonitor
    const offsetFromCenterX = (adaptedClip!.transform!.x - 1080 / 2)
    const offsetFromCenterY = (adaptedClip!.transform!.y - 1920 / 2)
    expect(offsetFromCenterX).toBe(0)
    expect(offsetFromCenterY).toBe(0)
  })

  it('creates an adjustment layer with kind: adjustment and fx badge defaults', () => {
    const store = useEditorStore.getState()
    const fxClipId = store.addAdjustmentLayer(2.0, 4.0)
    expect(fxClipId).toBeTruthy()

    const state = useEditorStore.getState()
    const clip = state.tracks.flatMap((t) => t.clips).find((c) => c.id === fxClipId)
    expect(clip).toBeDefined()
    expect(clip?.kind).toBe('adjustment')
    expect(clip?.start).toBe(2.0)
    expect(clip?.duration).toBe(4.0)
    expect(clip?.color).toBe('bg-violet-600')
    expect(state.selectedClipId).toBe(fxClipId)
  })

  it('freezes a frame, splitting the clip and inserting frozen middle hold', () => {
    const store = useEditorStore.getState()
    // c1 starts at 0, duration is 6.0
    const frozenId = store.freezeFrame('c1', 2.0, 3.0)
    expect(frozenId).toBeTruthy()

    const state = useEditorStore.getState()
    const track = state.tracks.find((t) => t.clips.some((c) => c.id === frozenId))
    expect(track).toBeDefined()

    const left = track!.clips.find((c) => c.id === 'c1')
    const frozen = track!.clips.find((c) => c.id === frozenId)
    expect(left).toBeDefined()
    expect(left?.duration).toBeCloseTo(2.0, 1)

    expect(frozen).toBeDefined()
    expect(frozen?.start).toBeCloseTo(2.0, 1)
    expect(frozen?.duration).toBe(3.0)
    expect(frozen?.freezeTime).toBeCloseTo(2.0, 1)
    expect(frozen?.title).toContain('Congelado')

    // Subsequent clips should be shifted
    const right = track!.clips.find((c) => c.start >= 5.0 && c.id !== frozenId)
    expect(right).toBeDefined()
    expect(right?.start).toBeCloseTo(5.0, 1)
  })
})
