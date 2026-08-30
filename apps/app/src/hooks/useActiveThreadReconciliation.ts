import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { refetchActiveThreadDetail } from "@/hooks/cache-owners/thread-detail-cache-owner";

export const ACTIVE_THREAD_RECONCILIATION_INTERVAL_MS = 1_000;

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
      await refetchActiveThreadDetail({ queryClient, threadId });

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
