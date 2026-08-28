// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeVoiceInput } from "@/lib/api";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import type { PromptBoxHandle } from "./PromptBoxInternal";
import { usePromptVoice } from "./usePromptVoice";

vi.mock("@/lib/api", () => ({
  transcribeVoiceInput: vi.fn(),
}));

vi.mock("@/hooks/useVoiceInput", () => ({
  useVoiceInput: vi.fn(),
}));

const voiceInput = {
  state: "transcribing" as const,
  isSupported: true,
  unsupportedReason: null,
  stream: null,
  start: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete window.bbDesktop;
});

describe("usePromptVoice", () => {
  it("waits for the completion transition after transcription resolves", async () => {
    vi.mocked(useVoiceInput).mockReturnValue({
      ...voiceInput,
      isRecording: false,
      isProcessing: true,
      isListening: false,
    });
    vi.mocked(transcribeVoiceInput).mockResolvedValue({ text: "Transcript" });

    let finishTransition: (() => void) | undefined;
    const playVoiceCompletionTransition = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishTransition = resolve;
        }),
    );
    const insertTextAtCursor = vi.fn();
    const promptBoxRef = {
      current: {
        captureHeightForLayoutChange: vi.fn(),
        focusEnd: vi.fn(),
        getTextBeforeCursor: vi.fn(),
        insertTextAtCursor,
        playVoiceCompletionTransition,
      } satisfies PromptBoxHandle,
    };

    renderHook(() => usePromptVoice(promptBoxRef, { isSidebarTarget: false }));
    const options = vi.mocked(useVoiceInput).mock.calls[0]?.[0];
    const transcription = options?.onTranscribe({
      file: new File([], "recording.webm", { type: "audio/webm" }),
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(playVoiceCompletionTransition).toHaveBeenCalledOnce();

    let settled = false;
    void transcription?.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    finishTransition?.();
    await expect(transcription).resolves.toBe("Transcript");
    expect(insertTextAtCursor).not.toHaveBeenCalled();
  });

  it("uses Apple on-device transcription when the desktop bridge exposes it", async () => {
    vi.mocked(useVoiceInput).mockReturnValue({
      ...voiceInput,
      isRecording: false,
      isProcessing: true,
      isListening: false,
    });
    const transcribe = vi.fn().mockResolvedValue({ text: "Native transcript" });
    window.bbDesktop = {
      speech: { transcribe },
    } as unknown as NonNullable<typeof window.bbDesktop>;
    const promptBoxRef = {
      current: {
        captureHeightForLayoutChange: vi.fn(),
        focusEnd: vi.fn(),
        getTextBeforeCursor: vi.fn(() => "AxeAI context"),
        insertTextAtCursor: vi.fn(),
        playVoiceCompletionTransition: vi.fn(() => Promise.resolve()),
      } satisfies PromptBoxHandle,
    };
    const file = new File(["audio"], "recording.m4a", {
      type: "audio/mp4",
    });
    const audio = new Uint8Array([1, 2, 3]).buffer;
    Object.defineProperty(file, "arrayBuffer", {
      value: vi.fn().mockResolvedValue(audio),
    });

    renderHook(() => usePromptVoice(promptBoxRef, { isSidebarTarget: false }));
    const options = vi.mocked(useVoiceInput).mock.calls[0]?.[0];

    await expect(
      options?.onTranscribe({
        file,
        promptContext: "AxeAI context",
      }),
    ).resolves.toBe("Native transcript");
    expect(transcribe).toHaveBeenCalledWith({
      audio,
      context: "AxeAI context",
      locale: navigator.language,
      mimeType: "audio/mp4",
    });
    expect(transcribeVoiceInput).not.toHaveBeenCalled();
  });
});
