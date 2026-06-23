import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Lightweight per-device "new since last visit" notifications.
 * Stores the last-seen timestamp per feature key in localStorage, scoped by user id.
 * No database table needed — keeps the app fast.
 */

function storageKey(userId: string | undefined, feature: string) {
  return `eduquest:seen:${userId ?? "anon"}:${feature}`;
}

function readSeen(userId: string | undefined, feature: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(storageKey(userId, feature));
  return raw ? Number(raw) || 0 : 0;
}

/** Returns how many items were created after the last time this feature was opened. */
export function useUnseenCount(
  userId: string | undefined,
  feature: string,
  items: { created_at?: string | null }[] | undefined,
): number {
  const [seen, setSeen] = useState<number>(() => readSeen(userId, feature));

  useEffect(() => {
    setSeen(readSeen(userId, feature));
  }, [userId, feature]);

  return useMemo(() => {
    if (!items || items.length === 0) return 0;
    return items.filter((i) => i.created_at && new Date(i.created_at).getTime() > seen).length;
  }, [items, seen]);
}

/** Call to mark a feature as seen (resets its unseen counter to 0). */
export function useMarkSeen(userId: string | undefined, feature: string) {
  return useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey(userId, feature), String(Date.now()));
  }, [userId, feature]);
}
