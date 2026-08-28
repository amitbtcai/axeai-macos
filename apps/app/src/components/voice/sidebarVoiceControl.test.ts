import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSidebarVoiceSnapshot,
  registerSidebarVoiceTarget,
  requestSidebarVoiceToggle,
} from "./sidebarVoiceControl";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.();
  vi.clearAllMocks();
});

function registerTarget(state: "idle" | "recording" | "transcribing") {
  const target = {
    focus: vi.fn(),
    voice: {
      state,
      isSupported: true,
      stream: null,
      start: vi.fn(),
      stop: vi.fn(),
      cancel: vi.fn(),
    },
  };
  cleanups.push(registerSidebarVoiceTarget(target));
  return target;
}

describe("sidebar voice control", () => {
  it("starts only the active composer target", () => {
    const first = registerTarget("idle");
    const second = registerTarget("idle");

    expect(requestSidebarVoiceToggle()).toBe(true);
    expect(second.focus).toHaveBeenCalledOnce();
    expect(second.voice.start).toHaveBeenCalledOnce();
    expect(first.voice.start).not.toHaveBeenCalled();
  });

  it("stops recording and exposes the recording state to the orb", () => {
    const target = registerTarget("recording");

    expect(getSidebarVoiceSnapshot().state).toBe("recording");
    expect(requestSidebarVoiceToggle()).toBe(true);
    expect(target.voice.stop).toHaveBeenCalledOnce();
    expect(target.voice.start).not.toHaveBeenCalled();
  });
});
