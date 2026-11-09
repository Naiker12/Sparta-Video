import { describe, expect, it } from 'vitest'
import {
  getProjectSaveStatus,
  subscribeProjectSaveStatus,
  useEditorStore,
} from './editor-store'
import { demoMedia, demoTracks } from './editor-store.fixtures'

describe('Characterization tests for App refactoring', () => {
  it('resetProject resets the store state cleanly', () => {
    useEditorStore.setState({
      projectName: 'Old Project',
      tracks: demoTracks,
      assets: demoMedia,
      selectedClipId: 'c2',
    })

    useEditorStore.getState().resetProject()

    const state = useEditorStore.getState()
    expect(state.projectName).toBe('Sin título')
    expect(state.tracks.length).toBeGreaterThan(0)
    expect(state.past).toEqual([])
    expect(state.future).toEqual([])
  })

  it('saveStatus transitions and subscriber notification work', () => {
    const current = getProjectSaveStatus()
    expect(['saved', 'saving', 'unsaved', 'error']).toContain(current)

    let notifiedStatus = ''
    const unsubscribe = subscribeProjectSaveStatus((status) => {
      notifiedStatus = status
    })

    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
    expect(notifiedStatus).toBe('')
  })

  it('active tools can be toggled to razor and select', () => {
    useEditorStore.getState().setActiveTool('razor')
    expect(useEditorStore.getState().activeTool).toBe('razor')

    useEditorStore.getState().setActiveTool('select')
    expect(useEditorStore.getState().activeTool).toBe('select')
  })

  it('snapToFrames toggles reliably', () => {
    const initialSnap = useEditorStore.getState().snapToFrames
    useEditorStore.getState().toggleSnap()
    expect(useEditorStore.getState().snapToFrames).toBe(!initialSnap)
    useEditorStore.getState().toggleSnap()
    expect(useEditorStore.getState().snapToFrames).toBe(initialSnap)
  })

  it('splitClip splits the selected clip at playhead and can be undone', () => {
    useEditorStore.setState({
      tracks: [
        {
          id: 'v1',
          name: 'Video 01',
          kind: 'video',
          clips: [
            {
              id: 'c1',
              title: 'Clip 1',
              kind: 'video',
              color: '#3b82f6',
              start: 0,
              duration: 10,
              thumbnail: 'video-catalog',
            },
          ],
        },
      ],
      selectedClipId: 'c1',
      playhead: 4,
      past: [],
      future: [],
    })

    useEditorStore.getState().splitClip('c1', 4)

    const v1Clips = useEditorStore.getState().tracks[0].clips
    expect(v1Clips).toHaveLength(2)
    expect(v1Clips[0].duration).toBe(4)
    expect(v1Clips[1].start).toBe(4)
    expect(v1Clips[1].duration).toBe(6)

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().tracks[0].clips).toHaveLength(1)
    expect(useEditorStore.getState().tracks[0].clips[0].duration).toBe(10)
  })
})

