// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  threadQueryKey,
  threadTimelineQueryKey,
} from "@/hooks/queries/query-keys";
import { createQueryClientTestHarness } from "@/test/queryClientTestHarness";
import {
  ACTIVE_THREAD_RECONCILIATION_INTERVAL_MS,
  useActiveThreadReconciliation,
} from "./useActiveThreadReconciliation";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useActiveThreadReconciliation", () => {
  it("refreshes active thread state and timeline, then stops when the turn becomes idle", async () => {
    vi.useFakeTimers();
    const { queryClient, wrapper } = createQueryClientTestHarness();
    const refetchQueries = vi
      .spyOn(queryClient, "refetchQueries")
      .mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ active }) =>
        useActiveThreadReconciliation({ active, threadId: "thread-1" }),
      { initialProps: { active: true }, wrapper },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        ACTIVE_THREAD_RECONCILIATION_INTERVAL_MS,
      );
    });

    expect(refetchQueries).toHaveBeenCalledTimes(2);
    expect(refetchQueries).toHaveBeenCalledWith({
      exact: true,
      queryKey: threadQueryKey("thread-1"),
      type: "active",
    });
    expect(refetchQueries).toHaveBeenCalledWith({
      exact: true,
      queryKey: threadTimelineQueryKey("thread-1"),
      type: "active",
    });

    rerender({ active: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        ACTIVE_THREAD_RECONCILIATION_INTERVAL_MS * 2,
      );
    });

    expect(refetchQueries).toHaveBeenCalledTimes(2);
  });
});
