import { z } from "zod";

export const bbDesktopSpeechTranscriptionResultSchema = z
  .object({
    text: z.string().min(1),
  })
  .strict();

export type BbDesktopSpeechTranscriptionResult = z.infer<
  typeof bbDesktopSpeechTranscriptionResultSchema
>;

export interface BbDesktopSpeechTranscriptionRequest {
  audio: ArrayBuffer;
  mimeType: string;
  locale?: string;
  context?: string;
}

export interface BbDesktopSpeechApi {
  /**
   * Transcribe recorded audio locally with Apple's SpeechAnalyzer. The method
   * is exposed only by compatible macOS desktop shells; callers must retain a
   * fallback for the web app and older shells.
   */
  transcribe(
    request: BbDesktopSpeechTranscriptionRequest,
  ): Promise<BbDesktopSpeechTranscriptionResult>;
}
