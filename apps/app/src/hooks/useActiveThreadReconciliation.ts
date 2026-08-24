import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  threadQueryKey,
  threadTimelineQueryKey,
} from "@/hooks/queries/query-keys";

export const ACTIVE_THREAD_RECONCILIATION_INTERVAL_MS = 1_000;

/**
 * Reconciles an active thread when a browser or tunnel misses a realtime
 * notification. Realtime remains the primary update path; this fallback only
 * runs for the currently active turn and stops as soon as the thread is idle.
 */
export function useActiveThreadReconciliation({
  active,
  threadId,
}: {
  active: boolean;
  threadId: string;
}): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!active || !threadId) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const reconcile = async (): Promise<void> => {
      await Promise.allSettled([
        queryClient.refetchQueries({
          exact: true,
          queryKey: threadQueryKey(threadId),
          type: "active",
        }),
        queryClient.refetchQueries({
          exact: true,
          queryKey: threadTimelineQueryKey(threadId),
          type: "active",
        }),
      ]);

      if (!cancelled) {
        timer = setTimeout(
          () => void reconcile(),
          ACTIVE_THREAD_RECONCILIATION_INTERVAL_MS,
        );
      }
    };

    timer = setTimeout(
      () => void reconcile(),
      ACTIVE_THREAD_RECONCILIATION_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [active, queryClient, threadId]);
}
