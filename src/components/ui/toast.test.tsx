import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toaster, errorMessage, toast, useToastStore } from './toast'

describe('toast system', () => {
  beforeEach(() => { vi.useFakeTimers(); useToastStore.setState({ toasts: [] }) })
  afterEach(() => { vi.useRealTimers() })

  it('renders variants with accessible live regions', () => {
    render(<Toaster />)
    act(() => { toast.success('Saved'); toast.error('Broken') })
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    expect(screen.getByRole('alert')).toHaveTextContent('Broken')
  })

  it('auto-dismisses after its duration', () => {
    render(<Toaster />)
    act(() => { toast.success('Bye', { duration: 1000 }) })
    act(() => { vi.advanceTimersByTime(1000) })
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.queryByText('Bye')).not.toBeInTheDocument()
  })

  it('keeps loading toasts until they are updated with the same id', () => {
    render(<Toaster />)
    let id = ''
    act(() => { id = toast.loading('Working') })
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(screen.getByText('Working')).toBeInTheDocument()
    act(() => { toast.success('Done', { id }) })
    expect(screen.queryByText('Working')).not.toBeInTheDocument()
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('runs the action and dismisses the toast', () => {
    const onClick = vi.fn()
    render(<Toaster />)
    act(() => { toast.info('Removed', { action: { label: 'Undo', onClick } }) })
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onClick).toHaveBeenCalledOnce()
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.queryByText('Removed')).not.toBeInTheDocument()
  })

  it('caps the visible stack', () => {
    act(() => { for (let index = 0; index < 8; index += 1) toast.info(`n${index}`) })
    expect(useToastStore.getState().toasts.map((item) => item.title)).toEqual(['n4', 'n5', 'n6', 'n7'])
  })

  it('normalizes Tauri string errors and JS errors', () => {
    expect(errorMessage('from rust', 'fallback')).toBe('from rust')
    expect(errorMessage(new Error('from js'), 'fallback')).toBe('from js')
    expect(errorMessage(undefined, 'fallback')).toBe('fallback')
  })
})
