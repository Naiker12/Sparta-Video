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

  // Map of clipId -> slot for fast lookups
  const clipToSlotMap = new Map<string, string>()
  for (const slot of template.slots) {
    clipToSlotMap.set(slot.targetClipId, slot.id)
  }

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

      // Check slot replacement by slotId, clipId, or registered targetClipId
      const slotKey =
        (clonedClip.slotId && fills[clonedClip.slotId] ? clonedClip.slotId : null) ||
        (fills[clonedClip.id] ? clonedClip.id : null) ||
        (clipToSlotMap.has(clonedClip.id) && fills[clipToSlotMap.get(clonedClip.id)!]
          ? clipToSlotMap.get(clonedClip.id)!
          : null)

      const fill = slotKey ? fills[slotKey] : undefined

      if (fill) {
        if (fill.type === 'text' && typeof fill.text === 'string') {
          clonedClip.text = fill.text
          clonedClip.title = fill.text.slice(0, 30)
        } else if (fill.type === 'color' && typeof fill.color === 'string') {
          clonedClip.color = fill.color
          if (clonedClip.textStyle) {
            clonedClip.textStyle = { ...clonedClip.textStyle, color: fill.color }
          }
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

