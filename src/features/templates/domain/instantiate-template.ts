import type { PersistedProjectState } from '../../projects/domain/project.types'
import type { SpartaTemplate, SlotFillValue } from './template.types'

export interface InstantiateOptions {
  projectName?: string
  slotFills?: Record<string, SlotFillValue>
}

export function instantiateTemplate(
  template: SpartaTemplate,
  options: InstantiateOptions = {},
): PersistedProjectState {
  const targetName = options.projectName?.trim() || `${template.name} - Copia`
  const fills = options.slotFills || {}

  // Deep clone state
  const clonedTracks = template.state.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      const clonedClip = {
        ...clip,
        transform: clip.transform ? { ...clip.transform } : undefined,
        crop: clip.crop ? { ...clip.crop } : undefined,
        textStyle: clip.textStyle ? { ...clip.textStyle } : undefined,
        textAnimation: clip.textAnimation ? { ...clip.textAnimation } : undefined,
        clipAnimation: clip.clipAnimation ? { ...clip.clipAnimation } : undefined,
        effects: clip.effects ? clip.effects.map((e) => ({ ...e, params: { ...e.params } })) : undefined,
        keyframes: clip.keyframes ? clip.keyframes.map((k) => ({ ...k })) : undefined,
      }

      // Check slot replacement
      const slotKey = clonedClip.slotId || clonedClip.id
      const fill = fills[slotKey]

      if (fill) {
        if (fill.type === 'text' && typeof fill.text === 'string') {
          clonedClip.text = fill.text
          clonedClip.title = fill.text.slice(0, 30)
        } else if (fill.assetId) {
          clonedClip.sourceAssetId = fill.assetId
        }
      }

      return clonedClip
    }),
  }))

  const clonedAssets = template.state.assets.map((asset) => ({ ...asset }))
  const clonedMarkers = template.state.markers.map((marker) => ({ ...marker }))

  return {
    projectName: targetName,
    sequence: { ...template.state.sequence },
    tracks: clonedTracks,
    assets: clonedAssets,
    markers: clonedMarkers,
    snapToFrames: template.state.snapToFrames ?? true,
    mutedTracks: [...(template.state.mutedTracks ?? [])],
    lockedTracks: [...(template.state.lockedTracks ?? [])],
  }
}

