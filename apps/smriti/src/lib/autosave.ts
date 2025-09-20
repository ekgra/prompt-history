import { useCallback, useEffect, useRef, useState } from 'react'
import { db, type DraftRecord, type SnapshotRecord, type SelectionSnapshot } from './db'

export interface DraftUpdate {
  projectName?: string
  promptName?: string
  docJson?: unknown
  selection?: SelectionSnapshot | null
}

export interface AutosaveState {
  draft: DraftRecord | null
  saving: boolean
  error?: unknown
  onChange: (update: DraftUpdate) => void
  restoreFromSnapshot: (snapshotId: number) => Promise<void>
}

export function useAutosave(
  draftId: string,
  opts?: { delayMs?: number; snapshotLimit?: number }
): AutosaveState {
  const delayMs = opts?.delayMs ?? 1200
  const snapshotLimit = opts?.snapshotLimit ?? 20

  const [draft, setDraft] = useState<DraftRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(undefined)

  const bufferRef = useRef<DraftUpdate>({})
  const timerRef = useRef<number | null>(null)

  // Load latest draft on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const existing = await db.drafts.get(draftId)
        if (!cancelled) setDraft(existing ?? null)
      } catch (e) {
        if (!cancelled) setError(e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [draftId])

  const flush = useCallback(async () => {
    if (!bufferRef.current) return
    const update = bufferRef.current
    bufferRef.current = {}
    setSaving(true)
    setError(undefined)
    try {
      const now = Date.now()
      const prev = await db.drafts.get(draftId)
      const next: DraftRecord = {
        id: draftId,
        projectName: update.projectName ?? prev?.projectName,
        promptName: update.promptName ?? prev?.promptName,
        docJson: update.docJson ?? prev?.docJson,
        selection: update.selection ?? prev?.selection ?? null,
        updatedAt: now,
        version: (prev?.version ?? 0) + 1,
      }
      await db.transaction('rw', db.drafts, db.snapshots, async () => {
        await db.drafts.put(next)
        // Snapshot
        await db.snapshots.add({
          draftId,
          docJson: next.docJson,
          selection: next.selection ?? null,
          createdAt: now,
        })
        // Enforce snapshot ring (keep last N)
        const count = await db.snapshots.where('draftId').equals(draftId).count()
        if (count > snapshotLimit) {
          const toDelete = count - snapshotLimit
          const oldest = await db.snapshots
            .where('draftId')
            .equals(draftId)
            .sortBy('createdAt')
          const ids = oldest.slice(0, toDelete).map((s: SnapshotRecord) => s.id!).filter(Boolean) as number[]
          if (ids.length) {
            await db.snapshots.bulkDelete(ids)
          }
        }
      })
      setDraft(next)
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }, [draftId, snapshotLimit])

  const onChange = useCallback((update: DraftUpdate) => {
    bufferRef.current = { ...bufferRef.current, ...update }
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void flush()
    }, delayMs)
  }, [delayMs, flush])

  // Flush when page becomes hidden or on pagehide (navigation/refresh)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (timerRef.current) window.clearTimeout(timerRef.current)
        void flush()
      }
    }
    const onPageHide = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      void flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [flush])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
      // Best-effort flush on unmount
      if (bufferRef.current && Object.keys(bufferRef.current).length > 0) {
        void flush()
      }
    }
  }, [flush])

  const restoreFromSnapshot = useCallback(async (snapshotId: number) => {
    const snap = await db.snapshots.get(snapshotId)
    if (!snap) return
    const now = Date.now()
    const prev = await db.drafts.get(draftId)
    const next: DraftRecord = {
      id: draftId,
      projectName: prev?.projectName,
      promptName: prev?.promptName,
      docJson: snap.docJson,
      selection: snap.selection ?? null,
      updatedAt: now,
      version: (prev?.version ?? 0) + 1,
    }
    await db.drafts.put(next)
    setDraft(next)
  }, [draftId])

  return { draft, saving, error, onChange, restoreFromSnapshot }
}
