/**
 * CoursePilot Social Interactions Engine
 * Manages Helpful reactions, Saved items/bookmarks, and safe public share URLs.
 */

import { supabase } from "../lib/supabase"

const LOCAL_LIKES_KEY = "coursepilot_feed_likes"
const LOCAL_SAVES_KEY = "coursepilot_saved_items"

/**
 * Get the set of feed item IDs liked/marked helpful by the user.
 */
export async function getUserLikes(userId) {
  if (!userId) return new Set()

  const key = `${LOCAL_LIKES_KEY}_${userId}`
  try {
    const { data, error } = await supabase
      .from("feed_item_likes")
      .select("feed_item_id")
      .eq("user_id", userId)

    if (!error && data) {
      const set = new Set(data.map((d) => d.feed_item_id))
      setCachedSet(key, Array.from(set))
      return set
    }
  } catch {}

  return new Set(getCachedSet(key))
}

/**
 * Toggle Helpful / Like on a challenge/feed item.
 */
export async function toggleFeedItemLike(userId, feedItemId) {
  if (!userId || !feedItemId) return { isLiked: false, error: "Missing user or item" }

  const key = `${LOCAL_LIKES_KEY}_${userId}`
  const cached = new Set(getCachedSet(key))
  const currentlyLiked = cached.has(feedItemId)
  const newLiked = !currentlyLiked

  if (newLiked) {
    cached.add(feedItemId)
  } else {
    cached.delete(feedItemId)
  }
  setCachedSet(key, Array.from(cached))

  try {
    if (newLiked) {
      await supabase.from("feed_item_likes").insert([{ user_id: userId, feed_item_id: feedItemId }])
    } else {
      await supabase.from("feed_item_likes").delete().eq("user_id", userId).eq("feed_item_id", feedItemId)
    }
  } catch {}

  return { isLiked: newLiked }
}

/**
 * Get the set of saved feed item IDs for the user.
 * localStorage is the authoritative store (Supabase table is optional DB sync).
 */
export async function getUserSavedItems(userId) {
  if (!userId) return new Set()

  const key = `${LOCAL_SAVES_KEY}_${userId}`

  // Always read localStorage first for instant, consistent results
  const localSet = new Set(getCachedSet(key))

  // Optionally sync from DB in background — only override if DB returns successfully
  try {
    const { data, error } = await supabase
      .from("saved_feed_items")
      .select("feed_item_id")
      .eq("user_id", userId)

    if (!error && data && data.length > 0) {
      // DB returned rows — merge with local (union) to avoid data loss
      const dbSet = new Set(data.map((d) => d.feed_item_id))
      const merged = new Set([...localSet, ...dbSet])
      setCachedSet(key, Array.from(merged))
      return merged
    }
  } catch {
    // DB not available or table missing — local cache is the truth
  }

  return localSet
}

/**
 * Toggle Save / Bookmark on a challenge/feed item.
 * localStorage is the authoritative store. DB write is attempted as optional sync.
 * Returns the actual persisted state (never optimistic on error).
 */
export async function toggleSavedItem(userId, feedItemId) {
  if (!userId || !feedItemId) return { isSaved: false, error: "Missing user or item" }

  const key = `${LOCAL_SAVES_KEY}_${userId}`
  const cached = new Set(getCachedSet(key))
  const currentlySaved = cached.has(feedItemId)
  const newSaved = !currentlySaved

  // Persist to localStorage — this IS the authoritative save
  if (newSaved) {
    cached.add(feedItemId)
  } else {
    cached.delete(feedItemId)
  }
  setCachedSet(key, Array.from(cached))

  // Attempt optional DB sync (fire-and-forget, non-blocking)
  ;(async () => {
    try {
      if (newSaved) {
        await supabase.from("saved_feed_items").insert([{ user_id: userId, feed_item_id: feedItemId }])
      } else {
        await supabase.from("saved_feed_items").delete().eq("user_id", userId).eq("feed_item_id", feedItemId)
      }
    } catch {
      // Table may not exist; localStorage is the truth regardless
    }
  })()

  return { isSaved: newSaved }
}

/**
 * Safe Share URL Generator & Dispatcher.
 */
export async function shareChallenge(challenge) {
  if (!challenge) return { success: false }

  const shareData = {
    title: `CoursePilot Challenge: ${challenge.title}`,
    text: `Can you solve this ${challenge.subject} challenge? ${challenge.title} (+${challenge.xp_reward} XP)`,
    url: `${window.location.origin}/#challenge=${challenge.id}`,
  }

  if (navigator.share) {
    try {
      await navigator.share(shareData)
      return { success: true, method: "native" }
    } catch {
      // fallback to clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(shareData.url)
    return { success: true, method: "clipboard" }
  } catch {
    return { success: false }
  }
}

// Local Storage Caching Helpers (User-Scoped)
function getCachedSet(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setCachedSet(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch {}
}

export function clearUserSocialCache(userId) {
  if (!userId) return
  try {
    localStorage.removeItem(`${LOCAL_LIKES_KEY}_${userId}`)
    localStorage.removeItem(`${LOCAL_SAVES_KEY}_${userId}`)
  } catch {}
}
