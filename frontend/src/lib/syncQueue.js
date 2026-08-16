import { db } from "./offlineDb"
import { supabase } from "./supabase"

/**
 * CoursePilot Sync Queue Manager
 * Queues offline user mutations (topic progress updates, attendance) and
 * reconciles them with Supabase when network connectivity is available.
 */

let isSyncing = false

export async function enqueueOperation({
  userId,
  entityType,
  entityId,
  operation,
  payload,
}) {
  if (!userId || !entityType || !operation) return null

  try {
    const queueItem = {
      user_id: userId,
      entity_type: entityType,
      entity_id: String(entityId),
      operation,
      payload,
      retry_count: 0,
      status: "pending",
      created_at: new Date().toISOString(),
    }

    const id = await db.sync_queue.add(queueItem)
    window.dispatchEvent(
      new CustomEvent("coursepilot:sync-queue-updated", {
        detail: { userId, count: await getPendingQueueCount(userId) },
      })
    )

    // Attempt immediate sync if online
    if (typeof navigator !== "undefined" && navigator.onLine) {
      processSyncQueue(userId)
    }

    return id
  } catch (err) {
    console.warn("[SyncQueue] enqueueOperation error:", err)
    return null
  }
}

export async function getPendingQueueCount(userId) {
  if (!userId) return 0
  try {
    return await db.sync_queue
      .where({ user_id: userId, status: "pending" })
      .count()
  } catch {
    return 0
  }
}

export async function processSyncQueue(userId) {
  if (isSyncing || !userId) return { success: true, count: 0 }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { success: false, reason: "offline" }
  }

  isSyncing = true
  let syncedCount = 0

  try {
    const pendingItems = await db.sync_queue
      .where({ user_id: userId, status: "pending" })
      .sortBy("created_at")

    if (!pendingItems.length) {
      isSyncing = false
      return { success: true, count: 0 }
    }

    console.info(`[SyncQueue] Processing ${pendingItems.length} queued operations for user=${userId}`)

    for (const item of pendingItems) {
      try {
        await db.sync_queue.update(item.id, { status: "syncing" })

        if (item.entity_type === "student_topic_progress") {
          const { error } = await supabase
            .from("student_topic_progress")
            .upsert(
              {
                user_id: item.user_id,
                syllabus_topic_id: Number(item.payload.syllabus_topic_id),
                status: item.payload.status,
                mastery_score: Number(item.payload.mastery_score),
                updated_at: item.payload.updated_at || new Date().toISOString(),
              },
              { onConflict: "user_id,syllabus_topic_id" }
            )

          if (error) throw error

          // Mark local topic progress as synced in IndexedDB
          await db.student_topic_progress.update(
            [item.user_id, Number(item.payload.syllabus_topic_id)],
            { pending_sync: false }
          )
        } else if (item.entity_type === "attendance_records") {
          const { error } = await supabase
            .from("attendance_records")
            .insert(item.payload)

          if (error) throw error
        }

        // Operation succeeded: delete from queue
        await db.sync_queue.delete(item.id)
        syncedCount++
      } catch (opErr) {
        console.warn(`[SyncQueue] Operation ${item.id} failed:`, opErr)
        await db.sync_queue.update(item.id, {
          status: "pending",
          retry_count: (item.retry_count || 0) + 1,
        })
      }
    }

    window.dispatchEvent(
      new CustomEvent("coursepilot:sync-complete", {
        detail: { userId, syncedCount, remaining: await getPendingQueueCount(userId) },
      })
    )
    window.dispatchEvent(
      new CustomEvent("coursepilot:sync-queue-updated", {
        detail: { userId, count: await getPendingQueueCount(userId) },
      })
    )
  } catch (err) {
    console.warn("[SyncQueue] processSyncQueue general error:", err)
  } finally {
    isSyncing = false
  }

  return { success: true, count: syncedCount }
}

// -------------------------------------------------------------
// ONLINE / OFFLINE GLOBAL EVENT LISTENERS
// -------------------------------------------------------------
let isInitialized = false

export function initSyncQueueListener(getUserIdFn) {
  if (isInitialized || typeof window === "undefined") return
  isInitialized = true

  window.addEventListener("online", () => {
    console.info("[SyncQueue] Network restored. Initiating automatic cloud sync...")
    const uid = typeof getUserIdFn === "function" ? getUserIdFn() : null
    if (uid) {
      processSyncQueue(uid)
    }
  })
}
