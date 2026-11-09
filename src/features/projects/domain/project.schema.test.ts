import { describe, expect, it } from 'vitest'
import {
  SPARTA_PROJECT_FORMAT,
  SPARTA_PROJECT_VERSION_V2,
} from './project.schema'
import { exportProjectData, parseProjectFile } from '../../editor/services/project-file'
import type { EditorState } from '../../editor/editor-store'

describe('Project schema and .sparta round-trip', () => {
  it('preserves text, subtitles, keyframes, opacity, effects and transitions on round-trip', () => {
    const complexProject: Partial<EditorState> = {
      projectName: 'Test Roundtrip Project',
      sequence: { width: 1080, height: 1920, frameRate: 30 },
      markers: [{ id: 'm1', time: 2.5, label: 'Beat drop' }],
      snapToFrames: true,
      mutedTracks: [],
      lockedTracks: [],
      assets: [
        {
          id: 'asset-1',
          title: 'video.mp4',
          detail: 'VIDEO · 1080x1920',
          thumb: 'video-catalog',
          type: 'video',
          durationSeconds: 12.5,
          width: 1080,
          height: 1920,
          status: 'ready',
        },
      ],
      tracks: [
        {
          id: 'v1',
          name: 'Video Track',
          kind: 'video',
          clips: [
            {
              id: 'c1',
              title: 'Intro Video',
              sourceAssetId: 'asset-1',
              start: 0,
              duration: 5,
              color: '#3b82f6',
              thumbnail: 'video-catalog',
              kind: 'video',
              opacity: 85,
              transform: { x: 540, y: 960, scaleX: 100, scaleY: 100, rotation: 0 },
              keyframes: [
                { property: 'opacity', time: 0, value: 0 },
                { property: 'opacity', time: 1, value: 85 },
              ],
              transitionIn: { effectId: 'fade', duration: 0.5 },
              effects: [
                { id: 'fx1', effectId: 'warm-vintage', enabled: true, intensity: 80, params: {} },
              ],
            },
            {
              id: 'sub1',
              title: 'Subtítulo 1',
              start: 0.5,
              duration: 2.5,
              color: '#fbbf24',
              thumbnail: 'text-overlay',
              kind: 'video',
              text: '¡Bienvenidos a Sparta Video!',
              opacity: 100,
              textStyle: {
                presetId: 'hormozi-karaoke',
                fontFamily: 'Impact',
                fontSize: 54,
                fontWeight: 900,
                color: '#ffffff',
                accentColor: '#facc15',
                strokeColor: '#000000',
                strokeWidth: 4,
                backgroundColor: '#000000',
                backgroundOpacity: 0.7,
                backgroundRadius: 8,
                shadowColor: '#000000',
                shadowBlur: 10,
                align: 'center',
                positionY: 80,
                uppercase: true,
                italic: false,
                letterSpacing: 1,
              },
              textAnimation: {
                in: 'pop',
                out: 'fade-out',
                loop: 'pulse',
                inDuration: 0.3,
                outDuration: 0.2,
              },
            },
          ],
        },
      ],
    }

    const exported = exportProjectData(complexProject as EditorState)
    expect(exported.version).toBe(SPARTA_PROJECT_VERSION_V2)
    expect(exported.format).toBe(SPARTA_PROJECT_FORMAT)

    const json = JSON.stringify(exported)
    const parsed = parseProjectFile(json)

    // Verify clips preserved all text and subtitles
    const parsedClips = parsed.project.tracks[0].clips
    expect(parsedClips).toHaveLength(2)

    // Clip 1 checks
    expect(parsedClips[0].opacity).toBe(85)
    expect(parsedClips[0].keyframes).toHaveLength(2)
    expect(parsedClips[0].transitionIn?.effectId).toBe('fade')
    expect(parsedClips[0].effects?.[0].effectId).toBe('warm-vintage')

    // Subtitle clip checks
    expect(parsedClips[1].text).toBe('¡Bienvenidos a Sparta Video!')
    expect(parsedClips[1].textStyle?.fontFamily).toBe('Impact')
    expect(parsedClips[1].textStyle?.fontSize).toBe(54)
    expect(parsedClips[1].textStyle?.color).toBe('#ffffff')
    expect(parsedClips[1].textAnimation?.in).toBe('pop')

    // Assets checks
    expect(parsed.project.assets[0].durationSeconds).toBe(12.5)
    expect(parsed.project.assets[0].width).toBe(1080)
    expect(parsed.project.assets[0].height).toBe(1920)

    // Second export matches first
    const reExported = exportProjectData({
      projectName: parsed.project.name,
      sequence: parsed.project.sequence,
      tracks: parsed.project.tracks,
      assets: parsed.project.assets,
      markers: parsed.project.markers,
      snapToFrames: parsed.project.snapToFrames,
      mutedTracks: parsed.project.mutedTracks,
      lockedTracks: parsed.project.lockedTracks,
    } as unknown as EditorState)

    expect(reExported.project).toEqual(exported.project)
  })

  it('v1 project files are parsed and upgraded to v2', () => {
    const v1Data = {
      format: SPARTA_PROJECT_FORMAT,
      version: 1,
      createdAt: '2026-10-01T12:00:00.000Z',
      project: {
        name: 'Legacy Project V1',
        sequence: { width: 1920, height: 1080, frameRate: 24 },
        tracks: [
          {
            id: 't1',
            name: 'Video 01',
            kind: 'video',
            clips: [
              {
                id: 'c1',
                title: 'Simple Clip',
                start: 0,
                duration: 5,
                color: '#3b82f6',
                thumbnail: 'video-catalog',
                kind: 'video',
              },
            ],
          },
        ],
        assets: [],
      },
    }

    const parsed = parseProjectFile(JSON.stringify(v1Data))
    expect(parsed.version).toBe(2)
    expect(parsed.id).toBeDefined()
    expect(parsed.project.name).toBe('Legacy Project V1')
    expect(parsed.project.tracks[0].clips[0].title).toBe('Simple Clip')
  })
})

