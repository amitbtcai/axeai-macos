import type { PromptVoiceConfig } from "@/components/promptbox/PromptBoxInternal";

interface SidebarVoiceTarget {
  focus: () => void;
  voice: PromptVoiceConfig;
}

export interface SidebarVoiceSnapshot {
  available: boolean;
  isSupported: boolean;
  pending: boolean;
  state: PromptVoiceConfig["state"];
}

const EMPTY_SNAPSHOT: SidebarVoiceSnapshot = {
  available: false,
  isSupported: false,
  pending: false,
  state: "idle",
};

let activeTarget: SidebarVoiceTarget | null = null;
let pendingStart = false;
let snapshot = EMPTY_SNAPSHOT;
const listeners = new Set<() => void>();

function publish(): void {
  const next: SidebarVoiceSnapshot = activeTarget
    ? {
        available: true,
        isSupported: activeTarget.voice.isSupported,
        pending: pendingStart,
        state: activeTarget.voice.state,
      }
    : pendingStart
      ? { ...EMPTY_SNAPSHOT, pending: true }
      : EMPTY_SNAPSHOT;
  if (
    next.available === snapshot.available &&
    next.isSupported === snapshot.isSupported &&
    next.pending === snapshot.pending &&
    next.state === snapshot.state
  ) {
    return;
  }
  snapshot = next;
  for (const listener of listeners) listener();
}

export function registerSidebarVoiceTarget(
  target: SidebarVoiceTarget,
): () => void {
  activeTarget = target;
  publish();

  if (pendingStart) {
    pendingStart = false;
    queueMicrotask(() => {
      if (activeTarget !== target) return;
      target.focus();
      void target.voice.start();
      publish();
    });
  }

  return () => {
    if (activeTarget !== target) return;
    activeTarget = null;
    publish();
  };
}

export function requestSidebarVoiceToggle(): boolean {
  const target = activeTarget;
  if (!target) {
    pendingStart = true;
    publish();
    return false;
  }

  target.focus();
  if (target.voice.state === "recording") {
    target.voice.stop();
  } else if (target.voice.state === "transcribing") {
    target.voice.cancel();
  } else {
    void target.voice.start();
  }
  return true;
}

export function subscribeSidebarVoice(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSidebarVoiceSnapshot(): SidebarVoiceSnapshot {
  return snapshot;
}
