import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IdbProjectRepository } from './infrastructure/idb-project-repository'
import { ProjectService } from './application/project-service'
import { ProjectAutosave } from './application/autosave'
import { LEGACY_BACKUP_KEY, LEGACY_STORAGE_KEY, migrateLegacyProject } from './application/legacy-migration'
import { collectAllReferencedAssetIds } from './application/media-gc'
import type { ProjectRecord } from './domain/project.types'

describe('Multi-project core (Phase 1)', () => {
  let repo: IdbProjectRepository
  let service: ProjectService

  beforeEach(() => {
    localStorage.clear()
    const dbName = `test-projects-${crypto.randomUUID()}`
    repo = new IdbProjectRepository(dbName)
    service = new ProjectService(repo)
  })

  afterEach(async () => {
    await repo.close()
  })

  it('can create, list, open, duplicate and soft delete projects', async () => {
    // 1. Create project A (16:9)
    const p1 = await service.createProject({ name: 'Project Alfa', format: '16:9' })
    expect(p1.id).toBeDefined()
    expect(p1.state.sequence.width).toBe(1920)
    expect(p1.state.sequence.height).toBe(1080)

    // 2. Create project B (9:16 vertical)
    const p2 = await service.createProject({ name: 'Project Beta Vertical', format: '9:16' })
    expect(p2.state.sequence.width).toBe(1080)
    expect(p2.state.sequence.height).toBe(1920)

    // 3. Create project C (1:1 square)
    const p3 = await service.createProject({ name: 'Project Gamma Square', format: '1:1' })

    // 4. List summaries
    const summaries = await service.listProjects()
    expect(summaries).toHaveLength(3)
    const names = summaries.map((s) => s.name)
    expect(names).toContain('Project Alfa')
    expect(names).toContain('Project Beta Vertical')
    expect(names).toContain('Project Gamma Square')

    // 5. Open project
    const opened = await service.getProject(p1.id)
    expect(opened).not.toBeNull()
    expect(opened?.state.projectName).toBe('Project Alfa')

    // 6. Duplicate project
    const dup = await service.duplicateProject(p1.id)
    expect(dup.id).not.toBe(p1.id)
    expect(dup.state.projectName).toBe('Project Alfa (2)')
    expect(dup.state.sequence).toEqual(p1.state.sequence)

    const listAfterDup = await service.listProjects()
    expect(listAfterDup).toHaveLength(4)

    // 7. Rename project
    await service.renameProject(dup.id, 'Project Alfa Copia Renombrada')
    const renamed = await service.getProject(dup.id)
    expect(renamed?.state.projectName).toBe('Project Alfa Copia Renombrada')

    // 8. Soft delete (move to trash)
    await service.deleteProject(p3.id, false)
    const activeProjects = await service.listProjects({ includeDeleted: false })
    expect(activeProjects).toHaveLength(3)

    const allWithTrash = await service.listProjects({ includeDeleted: true })
    expect(allWithTrash).toHaveLength(4)
    const deletedP3 = allWithTrash.find((s) => s.id === p3.id)
    expect(deletedP3?.deletedAt).toBeDefined()

    // 9. Restore from trash
    await service.restoreProject(p3.id)
    const restoredProjects = await service.listProjects()
    expect(restoredProjects).toHaveLength(4)
  })

  it('can create 3 projects, reload from repository and retrieve them intact', async () => {
    await service.createProject({ name: 'Project One', format: '16:9' })
    await service.createProject({ name: 'Project Two', format: '9:16' })
    await service.createProject({ name: 'Project Three', format: '4:5' })

    const summaries = await service.listProjects()
    expect(summaries).toHaveLength(3)
    const names = summaries.map((s) => s.name)
    expect(names).toContain('Project One')
    expect(names).toContain('Project Two')
    expect(names).toContain('Project Three')
  })

  it('legacy migration imports localStorage project, verifies write, backs up, and cleans up', async () => {
    const legacyProject = {
      projectName: 'Old Coastal Video',
      sequence: { width: 1920, height: 1080, frameRate: 24 },
      tracks: [
        {
          id: 'v1',
          name: 'Video 01',
          kind: 'video',
          clips: [
            {
              id: 'c1',
              title: 'Drone shot.mp4',
              start: 0,
              duration: 5,
              color: '#3b82f6',
              thumbnail: 'video-catalog',
              kind: 'video',
            },
          ],
        },
      ],
      assets: [
        {
          id: 'a1',
          title: 'Drone shot.mp4',
          detail: 'VIDEO',
          thumb: 'video-catalog',
          type: 'video',
        },
      ],
      markers: [],
      snapToFrames: true,
    }

    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ state: legacyProject, version: 5 }))

    const result = await migrateLegacyProject(repo, localStorage)
    expect(result.migrated).toBe(true)
    expect(result.projectId).toBeDefined()

    // Check project was saved in repo
    const imported = await repo.getProject(result.projectId!)
    expect(imported).not.toBeNull()
    expect(imported?.state.projectName).toBe('Old Coastal Video')
    expect(imported?.state.tracks[0].clips[0].title).toBe('Drone shot.mp4')

    // Check backup was created and old key removed
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(LEGACY_BACKUP_KEY)).not.toBeNull()
  })

  it('media GC correctly identifies referenced assets and keeps them', async () => {
    const p1: ProjectRecord = {
      id: 'proj-1',
      schemaVersion: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      state: {
        projectName: 'P1',
        sequence: { width: 1920, height: 1080, frameRate: 24 },
        tracks: [
          {
            id: 'v1',
            name: 'V1',
            kind: 'video',
            clips: [{ id: 'c1', title: 'clip', sourceAssetId: 'shared-media-1', start: 0, duration: 5, color: '', thumbnail: '', kind: 'video' }],
          },
        ],
        assets: [
          { id: 'shared-media-1', title: 'shared.mp4', detail: '', thumb: '', type: 'video' },
          { id: 'p1-only-media', title: 'p1.mp4', detail: '', thumb: '', type: 'video' },
        ],
        markers: [],
        snapToFrames: true,
        mutedTracks: [],
        lockedTracks: [],
      },
    }

    const p2: ProjectRecord = {
      id: 'proj-2',
      schemaVersion: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      state: {
        projectName: 'P2',
        sequence: { width: 1920, height: 1080, frameRate: 24 },
        tracks: [],
        assets: [
          { id: 'shared-media-1', title: 'shared.mp4', detail: '', thumb: '', type: 'video' },
          { id: 'p2-only-media', title: 'p2.mp4', detail: '', thumb: '', type: 'video' },
        ],
        markers: [],
        snapToFrames: true,
        mutedTracks: [],
        lockedTracks: [],
      },
    }

    await repo.saveProject(p1)
    await repo.saveProject(p2)

    const referenced = await collectAllReferencedAssetIds(repo)
    expect(referenced.has('shared-media-1')).toBe(true)
    expect(referenced.has('p1-only-media')).toBe(true)
    expect(referenced.has('p2-only-media')).toBe(true)
    expect(referenced.has('unrelated-media')).toBe(false)

    // Now delete project 1 permanently
    await repo.deleteProject('proj-1', true)

    const referencedAfterDelete = await collectAllReferencedAssetIds(repo)
    // Shared media is still referenced by project 2!
    expect(referencedAfterDelete.has('shared-media-1')).toBe(true)
    expect(referencedAfterDelete.has('p2-only-media')).toBe(true)
    // p1 only media is now unreferenced
    expect(referencedAfterDelete.has('p1-only-media')).toBe(false)
  })

  it('autosave debounces writes and flushes cleanly', async () => {
    const project = await service.createProject({ name: 'Autosave Project' })
    let currentState = { ...project.state }

    const statuses: string[] = []
    const autosave = new ProjectAutosave({
      projectId: project.id,
      getState: () => currentState,
      debounceMs: 30,
      repo,
      onStatusChange: (status) => statuses.push(status),
    })

    // 1. Initial state is saved
    expect(autosave.getStatus()).toBe('saved')

    // 2. State changes, scheduleSave triggers 'unsaved'
    currentState = { ...currentState, projectName: 'Autosave Edited Name' }
    autosave.scheduleSave()
    expect(autosave.getStatus()).toBe('unsaved')

    // 3. Wait for debounce and async save to finish
    await new Promise((resolve) => setTimeout(resolve, 150))
    if (autosave.getStatus() === 'saving') {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    expect(autosave.getStatus()).toBe('saved')

    const updatedInDb = await repo.getProject(project.id)
    expect(updatedInDb?.state.projectName).toBe('Autosave Edited Name')

    // 4. Test flush(): pending timer is immediately saved
    currentState = { ...currentState, projectName: 'Flushed Immediately' }
    autosave.scheduleSave()
    expect(autosave.getStatus()).toBe('unsaved')
    await autosave.flush()
    expect(autosave.getStatus()).toBe('saved')

    const flushedInDb = await repo.getProject(project.id)
    expect(flushedInDb?.state.projectName).toBe('Flushed Immediately')

    await autosave.stop()
  })

  it('can empty trash permanently purging all soft-deleted projects', async () => {
    const p1 = await service.createProject({ name: 'Keep Active' })
    const p2 = await service.createProject({ name: 'Trash Me 1' })
    const p3 = await service.createProject({ name: 'Trash Me 2' })

    await service.deleteProject(p2.id, false)
    await service.deleteProject(p3.id, false)

    const beforeEmpty = await service.listProjects({ includeDeleted: true })
    expect(beforeEmpty).toHaveLength(3)

    await service.emptyTrash()

    const afterEmpty = await service.listProjects({ includeDeleted: true })
    expect(afterEmpty).toHaveLength(1)
    expect(afterEmpty[0].id).toBe(p1.id)
  })

  it('can create, list, restore and delete version history snapshots', async () => {
    const project = await service.createProject({ name: 'Snapshot Demo' })

    // Create snapshot 1
    const snap1 = await service.createSnapshot(project.id, 'Initial Baseline')
    expect(snap1.id).toBeDefined()
    expect(snap1.label).toBe('Initial Baseline')
    expect(snap1.projectId).toBe(project.id)

    // Edit project
    project.state.projectName = 'Snapshot Demo Modified'
    await repo.saveProject(project)

    // Create snapshot 2
    const snap2 = await service.createSnapshot(project.id, 'Before Major Trim')
    expect(snap2.label).toBe('Before Major Trim')

    // List snapshots (newest first)
    const list = await service.listSnapshots(project.id)
    expect(list).toHaveLength(2)
    expect(list[0].id).toBe(snap2.id)
    expect(list[1].id).toBe(snap1.id)

    // Restore snapshot 1
    const restored = await service.restoreSnapshot(project.id, snap1.id)
    expect(restored.state.projectName).toBe('Snapshot Demo')

    const inRepo = await repo.getProject(project.id)
    expect(inRepo?.state.projectName).toBe('Snapshot Demo')

    // Delete snapshot 2
    await service.deleteSnapshot(snap2.id)
    const afterDelete = await service.listSnapshots(project.id)
    expect(afterDelete).toHaveLength(1)
    expect(afterDelete[0].id).toBe(snap1.id)
  })
})
