import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useEditorStore } from './features/editor/editor-store'
import { demoMedia, demoTracks } from './features/editor/model'

describe('Sparta Video editor preview', () => {
  beforeEach(() => useEditorStore.setState({ projectName: 'Coastal film', sequence: { width: 1920, height: 1080, frameRate: 24 }, tracks: demoTracks, assets: demoMedia, markers: [], selectedClipId: 'c2', selectedMediaId: null, snapToFrames: true, activeTool: 'select', playhead: 8.8, zoom: 1, playing: false, mutedTracks: [], lockedTracks: [], past: [], future: [] }))
  it('shows the editor and updates the inspector when a clip is selected', () => {
    render(<App />)
    expect(screen.getByText('Media library')).toBeInTheDocument()
    expect(screen.getAllByText('Sequence 01')).toHaveLength(2)

    fireEvent.click(screen.getAllByRole('button', { name: /coastline_drone_04\.mp4/ })[0])
    expect(screen.getAllByText('coastline_drone_04.mp4').length).toBeGreaterThan(1)
  })

  it('can submit a simulated assistant prompt', async () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Message Sparta AI'), { target: { value: 'Make it cinematic' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(await screen.findByText('Mock proposal · review only')).toBeInTheDocument()
    expect(screen.getByText('0 project changes · none applied')).toBeInTheDocument()
  })

  it('advances playback by the active sequence frame rate', () => {
    vi.useFakeTimers()
    const { unmount } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    act(() => { vi.advanceTimersByTime(1000) })
    expect(useEditorStore.getState().playhead).toBeCloseTo(9.8)
    unmount()
    vi.useRealTimers()
  })

  it('runs the export demo through a cancellable service and states that no file was created', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export preview' }))
    expect(await screen.findByText(/no se creó ningún archivo/i, {}, { timeout: 2500 })).toBeInTheDocument()
  })

  it('closes the export dialog with Escape even when its filename field has focus', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    fireEvent.keyDown(screen.getByLabelText('Nombre del archivo'), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Export video' })).not.toBeInTheDocument()
  })

  it('adds a media item and undoes that timeline change', () => {
    render(<App />)
    const harbor = screen.getByRole('button', { name: /harbor_sunrise\.mov/ })
    fireEvent.doubleClick(harbor)
    expect(screen.getAllByText('harbor_sunrise.mov').length).toBeGreaterThan(1)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getAllByText('harbor_sunrise.mov')).toHaveLength(1)
  })

  it('shows different inspector controls for motion and audio', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Motion' }))
    expect(screen.getAllByText('◇ Add keyframe')).toHaveLength(2)
    fireEvent.click(screen.getByRole('tab', { name: 'Audio' }))
    expect(screen.getByLabelText('Clip volume')).toBeInTheDocument()
  })

  it('marks a locked clip read-only in the inspector and restores editing when unlocked', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Lock Video 01' }))
    expect(screen.getByText(/Track locked/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Position X')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Unlock Video 01' }))
    expect(screen.queryByText(/Track locked/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Position X')).toBeEnabled()
  })

  it('reports clipboard success or failure after using Copy clip name', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Inspector options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy clip name' }))
    expect(writeText).toHaveBeenCalledWith('coastline_drone_04.mp4')
    expect(await screen.findByText('Nombre del clip copiado.')).toBeInTheDocument()
  })

  it('does not expose a disabled status action in the footer', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: 'More status details' })).not.toBeInTheDocument()
  })

  it('exposes preference categories as selected tabs and persists animation preference', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Open preferences' }))
    const general = screen.getByRole('tab', { name: 'General' })
    expect(general).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }))
    expect(screen.getByRole('tab', { name: 'Appearance' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('switch', { name: /Interface animations/ }))
    expect(localStorage.getItem('sparta-ui-animations')).toBe('off')
  })

  it('moves through preference tabs with the arrow keys', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Open preferences' }))
    const general = screen.getByRole('tab', { name: 'General' })
    general.focus()
    fireEvent.keyDown(general, { key: 'ArrowDown' })
    expect(screen.getByRole('tab', { name: 'Appearance' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Appearance' }), { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Shortcuts' })).toHaveFocus()
  })

  it('shows the real project save state in preferences', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Open preferences' }))
    expect(screen.getByText('Saved here')).toBeInTheDocument()
  })

  it('does not trigger global playback shortcuts while a timeline clip button has focus', () => {
    render(<App />)
    const clip = screen.getAllByRole('button', { name: /coastline_drone_04\.mp4/ }).find((button) => button.classList.contains('timeline-clip'))
    expect(clip).toBeDefined()
    clip?.focus()
    fireEvent.keyDown(clip!, { key: ' ', code: 'Space' })
    expect(useEditorStore.getState().playing).toBe(false)
    fireEvent.keyDown(clip!, { key: 'ArrowRight' })
    expect(useEditorStore.getState().playhead).toBe(8.8)
  })

  it('prevents Backspace from navigating the browser when deleting a selected clip', () => {
    render(<App />)
    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(useEditorStore.getState().tracks[0].clips.some((clip) => clip.id === 'c2')).toBe(false)
  })

  it('cuts with Razor at the point clicked inside a clip', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Razor/ }))
    const clip = document.querySelector<HTMLButtonElement>('.timeline-clip.clip-selected')
    expect(clip).not.toBeNull()
    vi.spyOn(clip!, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, right: 207.7, top: 0, bottom: 40, width: 207.7, height: 40, toJSON: () => ({}) })
    fireEvent.pointerDown(clip!, { button: 0, clientX: 103.85, clientY: 20 })
    expect(useEditorStore.getState().tracks.flatMap((track) => track.clips)).toHaveLength(7)
    expect(useEditorStore.getState().tracks[0].clips.find((item) => item.id === 'c2')?.duration).toBeCloseTo(3.325)
  })

  it('filters still images separately from video and audio assets', () => {
    useEditorStore.getState().addAssets([{ id: 'image-still', title: 'cover.png', detail: 'IMAGE · 12 KB', thumb: 'coast', type: 'image', status: 'catalog-only' }])
    render(<App />)
    const library = screen.getByText('Media library').closest('aside')!
    fireEvent.click(screen.getByRole('button', { name: 'Filter media' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Images' }))
    expect(within(library).getByRole('button', { name: /cover\.png/ })).toBeInTheDocument()
    expect(within(library).queryByRole('button', { name: /coastline_drone_04\.mp4/ })).not.toBeInTheDocument()
  })

  it('opens project menus that include section headings without runtime errors', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Project actions' }))
    const menu = screen.getByRole('menu', { name: 'Project actions' })
    expect(menu).toHaveTextContent('PROJECT')
    expect(within(menu).getByRole('menuitem', { name: 'Rename project' })).toBeInTheDocument()
  })

  it('keeps track controls aligned with timeline lanes during vertical scrolling', () => {
    render(<App />)
    const controls = document.querySelector<HTMLElement>('.track-controls')!
    const timeline = screen.getByRole('region', { name: 'Timeline tracks' })
    controls.scrollTop = 55
    fireEvent.scroll(controls)
    expect(timeline.scrollTop).toBe(55)
    timeline.scrollTop = 20
    fireEvent.scroll(timeline)
    expect(controls.scrollTop).toBe(20)
  })

  it('scrubs the playhead by dragging the ruler and accounts for horizontal scroll', () => {
    render(<App />)
    const timeline = screen.getByRole('region', { name: 'Timeline tracks' }) as HTMLDivElement
    const ruler = document.querySelector<HTMLElement>('.ruler')!
    vi.spyOn(timeline, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, right: 880, top: 0, bottom: 400, width: 880, height: 400, toJSON: () => ({}) })
    timeline.scrollLeft = 100
    fireEvent.pointerDown(ruler, { button: 0, clientX: 62 })
    expect(useEditorStore.getState().playhead).toBeCloseTo(Math.round((162 / 31) * 24) / 24)
    fireEvent.pointerMove(window, { clientX: 124 })
    expect(useEditorStore.getState().playhead).toBeCloseTo(Math.round((224 / 31) * 24) / 24)
    fireEvent.pointerUp(window)
  })
})
