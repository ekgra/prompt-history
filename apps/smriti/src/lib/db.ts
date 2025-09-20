import Dexie, { Table } from 'dexie'

// Basic types for persisted structures
export type DocJSON = unknown

export interface SelectionSnapshot {
  from: number
  to: number
}

export interface DraftRecord {
  id: string
  projectName?: string
  promptName?: string
  docJson?: DocJSON
  selection?: SelectionSnapshot | null
  updatedAt: number
  version: number
}

export interface SnapshotRecord {
  id?: number
  draftId: string
  docJson?: DocJSON
  selection?: SelectionSnapshot | null
  createdAt: number
}

export interface BlobRecord {
  id?: number
  draftId: string
  blob: Blob
}

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error'

export interface UploadQueueRecord {
  id?: number
  draftId: string
  blobId: number
  status: UploadStatus
  remoteUrl?: string
  error?: string
  updatedAt: number
}

export interface ServerPromptRecord {
  id: string
  projectName?: string
  promptName?: string
  docJson?: DocJSON
  updatedAt: number
  version: number
}

class SmritiDB extends Dexie {
  drafts!: Table<DraftRecord, string>
  snapshots!: Table<SnapshotRecord, number>
  blobs!: Table<BlobRecord, number>
  uploadQueue!: Table<UploadQueueRecord, number>
  serverPrompts!: Table<ServerPromptRecord, string>

  constructor() {
    super('smriti-db')
    this.version(1).stores({
      drafts: 'id, updatedAt, projectName, promptName',
      snapshots: '++id, draftId, createdAt',
      blobs: '++id, draftId',
      uploadQueue: '++id, draftId, status, updatedAt',
      serverPrompts: 'id, updatedAt, projectName, promptName',
    })
  }
}

export const db = new SmritiDB()

