import type { MediaItem, TimelineMarker, Track } from '../../editor/model'
import type { ProjectRecord, ProjectSummary } from './project.types'

export function calculateProjectDuration(tracks: Track[], markers: TimelineMarker[] = []): number {
  const clipEnds = tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration))
  const markerTimes = markers.map((m) => m.time)
  return Math.max(0, ...clipEnds, ...markerTimes)
}

export function countProjectClips(tracks: Track[]): number {
  return tracks.reduce((sum, track) => sum + track.clips.length, 0)
}

export function checkHasMissingMedia(assets: MediaItem[]): boolean {
  return assets.some((a) => a.status === 'missing' || a.status === 'error')
}

export function findFirstCoverAssetId(tracks: Track[], assets: MediaItem[]): string | undefined {
  // First look for video or image clips on timeline
  for (const track of tracks) {
    if (track.kind === 'video') {
      for (const clip of track.clips) {
        if (clip.sourceAssetId) {
          const asset = assets.find((a) => a.id === clip.sourceAssetId)
          if (asset && (asset.type === 'video' || asset.type === 'image')) {
            return asset.id
          }
        }
      }
    }
  }
  // Fallback to first video or image asset in library
  const firstVisual = assets.find((a) => a.type === 'video' || a.type === 'image')
  return firstVisual?.id
}

export function createProjectSummary(record: ProjectRecord): ProjectSummary {
  const durationSeconds = calculateProjectDuration(record.state.tracks, record.state.markers)
  const clipCount = countProjectClips(record.state.tracks)
  const hasMissingMedia = checkHasMissingMedia(record.state.assets)
  const coverAssetId = findFirstCoverAssetId(record.state.tracks, record.state.assets)

  return {
    id: record.id,
    name: record.state.projectName || 'Sin título',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    durationSeconds,
    clipCount,
    sequence: record.state.sequence,
    coverBlobKey: `cover-${record.id}`,
    coverAssetId,
    hasMissingMedia,
  }
}

