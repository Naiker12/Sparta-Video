import { beforeEach, describe, expect, it } from 'vitest'
import { exportProjectData, parseProjectFile, loadProjectFromFile, SPARTA_PROJECT_FORMAT } from './project-file'
import { useEditorStore } from '../editor-store'
import { demoTracks, demoMedia } from '../editor-store.fixtures'

describe('project-file portable format', () => {
  beforeEach(() => {
    useEditorStore.setState({
      projectName: 'Test Film',
      sequence: { width: 1920, height: 1080, frameRate: 30 },
      tracks: demoTracks,
      assets: demoMedia,
      markers: [{ id: 'm1', time: 5, label: 'Intro' }],
      snapToFrames: true,
      mutedTracks: ['a1'],
      lockedTracks: ['v1'],
    })
  })

  it('exports current project state into a valid Sparta schema format', () => {
    const data = exportProjectData()
    expect(data.format).toBe(SPARTA_PROJECT_FORMAT)
    expect(data.version).toBe(1)
    expect(data.project.name).toBe('Test Film')
    expect(data.project.sequence.frameRate).toBe(30)
    expect(data.project.tracks.length).toBeGreaterThan(0)
    expect(data.project.assets.length).toBeGreaterThan(0)
    expect(data.project.markers).toEqual([{ id: 'm1', time: 5, label: 'Intro' }])
  })

  it('parses valid exported json and restores into editor store', () => {
    const data = exportProjectData()
    const json = JSON.stringify(data)
    const parsed = parseProjectFile(json)
    expect(parsed.project.name).toBe('Test Film')

    // Reset store
    useEditorStore.getState().resetProject()
    expect(useEditorStore.getState().projectName).toBe('Sin título')
    expect(useEditorStore.getState().assets).toEqual([])

    // Load from parsed
    loadProjectFromFile(parsed)
    const state = useEditorStore.getState()
    expect(state.projectName).toBe('Test Film')
    expect(state.assets.length).toBe(demoMedia.length)
    expect(state.markers).toEqual([{ id: 'm1', time: 5, label: 'Intro' }])
    expect(state.mutedTracks).toEqual(['a1'])
    expect(state.lockedTracks).toEqual(['v1'])
  })

  it('rejects corrupt or invalid json files', () => {
    expect(() => parseProjectFile('{"invalid": true}')).toThrow()
    expect(() => parseProjectFile('not json')).toThrow()
  })
})
