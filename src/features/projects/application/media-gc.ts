import type { ProjectRepository } from './project-repository'
import { defaultProjectRepository } from '../infrastructure/idb-project-repository'
import { pruneStoredMedia } from '../../editor/services/media-storage'

/**
 * Scans all existing projects and collects all referenced media asset IDs.
 * Any media in IndexedDB not referenced by ANY project will be pruned.
 */
export async function collectAllReferencedAssetIds(
  repo: ProjectRepository = defaultProjectRepository,
): Promise<Set<string>> {
  const projects = await repo.getAllProjects()
  const referenced = new Set<string>()

  for (const project of projects) {
    for (const asset of project.state.assets) {
      if (asset.id) referenced.add(asset.id)
    }
    for (const track of project.state.tracks) {
      for (const clip of track.clips) {
        if (clip.sourceAssetId) referenced.add(clip.sourceAssetId)
      }
    }
  }

  return referenced
}

/**
 * Prunes unreferenced media files and thumbnails safely.
 * Only deletes files that no project references.
 */
export async function pruneUnreferencedMedia(
  repo: ProjectRepository = defaultProjectRepository,
): Promise<{ keptCount: number }> {
  const referenced = await collectAllReferencedAssetIds(repo)
  await pruneStoredMedia(Array.from(referenced))
  return { keptCount: referenced.size }
}

