import { useCallback, useEffect, useMemo, type RefObject } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { transcribeVoiceInput } from "@/lib/api";
import { registerSidebarVoiceTarget } from "@/components/voice/sidebarVoiceControl";
import type { PromptBoxHandle, PromptVoiceConfig } from "./PromptBoxInternal";

async function requestVoiceTranscription({
  file,
  promptContext,
  signal,
}: {
  file: File;
  promptContext?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const appleSpeech = window.bbDesktop?.speech;
  if (appleSpeech) {
    try {
      const audio = await file.arrayBuffer();
      if (signal?.aborted) throw createVoiceAbortError();
      const result = await appleSpeech.transcribe({
        audio,
        mimeType: file.type,
        locale: navigator.language,
        ...(promptContext ? { context: promptContext } : {}),
      });
      if (signal?.aborted) throw createVoiceAbortError();
      return result.text;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      // Older locales, missing Apple models, and unsupported media formats use
      // the existing server path so the desktop control never becomes a dead end.
    }
  }
  const transcription = await transcribeVoiceInput(file, promptContext, signal);
  return transcription.text;
}

function createVoiceAbortError(): DOMException {
  return new DOMException("Voice transcription was cancelled", "AbortError");
}

export function usePromptVoice(
  promptBoxRef: RefObject<PromptBoxHandle | null>,
  options: { isSidebarTarget?: boolean } = {},
): PromptVoiceConfig {
  const onTranscript = useCallback(
    (text: string) => {
      promptBoxRef.current?.insertTextAtCursor(text);
    },
    [promptBoxRef],
  );

  const getPromptContext = useCallback(
    () => promptBoxRef.current?.getTextBeforeCursor(),
    [promptBoxRef],
  );

  const transcribeAfterCompletionTransition = useCallback(
    async (args: Parameters<typeof requestVoiceTranscription>[0]) => {
      const text = await requestVoiceTranscription(args);
      await promptBoxRef.current?.playVoiceCompletionTransition();
      if (args.signal?.aborted) {
        throw createVoiceAbortError();
      }
      return text;
    },
    [promptBoxRef],
  );

  const voiceInput = useVoiceInput({
    onTranscript,
    onTranscribe: transcribeAfterCompletionTransition,
    getPromptContext,
    preferredMimeTypes: window.bbDesktop?.speech
      ? ["audio/mp4", "audio/webm", "audio/ogg"]
      : undefined,
  });

  useEffect(() => {
    if (options.isSidebarTarget === false) return;
    return registerSidebarVoiceTarget({
      focus: () => promptBoxRef.current?.focusEnd(),
      voice: {
        state: voiceInput.state,
        isSupported: voiceInput.isSupported,
        unsupportedReason: voiceInput.unsupportedReason,
        stream: voiceInput.stream,
        start: voiceInput.start,
        stop: voiceInput.stop,
        cancel: voiceInput.cancel,
      },
    });
  }, [
    options.isSidebarTarget,
    promptBoxRef,
    voiceInput.cancel,
    voiceInput.isSupported,
    voiceInput.start,
    voiceInput.state,
    voiceInput.stop,
    voiceInput.stream,
    voiceInput.unsupportedReason,
  ]);

  return useMemo<PromptVoiceConfig>(
    () => ({
      state: voiceInput.state,
      isSupported: voiceInput.isSupported,
      stream: voiceInput.stream,
      start: voiceInput.start,
      stop: voiceInput.stop,
      cancel: voiceInput.cancel,
    }),
    [
      voiceInput.state,
      voiceInput.isSupported,
      voiceInput.stream,
      voiceInput.start,
      voiceInput.stop,
      voiceInput.cancel,
    ],
  );
}
