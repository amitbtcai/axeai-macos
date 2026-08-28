import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { app, ipcMain } from "electron";
import { bbDesktopSpeechTranscriptionResultSchema } from "@bb/desktop-contract";
import { BB_DESKTOP_APPLE_SPEECH_TRANSCRIBE_CHANNEL } from "./apple-speech-ipc.js";

const execFileAsync = promisify(execFile);
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_CONTEXT_LENGTH = 2_000;

const speechRequestSchema = z
  .object({
    audio: z.instanceof(Uint8Array).refine((value) => value.byteLength > 0),
    mimeType: z.string().min(1).max(100),
    locale: z.string().min(1).max(100).optional(),
    context: z.string().max(MAX_CONTEXT_LENGTH).optional(),
  })
  .strict();

const helperOutputSchema = z
  .object({
    text: z.string().nullable().optional(),
    error: z.string().nullable().optional(),
  })
  .strict();

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function resolveHelperPath(): string {
  const unpackedRoot = app.isPackaged
    ? join(process.resourcesPath, "app.asar.unpacked", "dist")
    : __dirname;
  return join(unpackedRoot, "native", "axeai-apple-speech");
}

function parseHelperOutput(raw: string): { text?: string; error?: string } {
  const decoded: unknown = JSON.parse(raw.trim());
  const parsed = helperOutputSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new Error("Apple speech helper returned an invalid response.");
  }
  return {
    ...(parsed.data.text ? { text: parsed.data.text } : {}),
    ...(parsed.data.error ? { error: parsed.data.error } : {}),
  };
}

export function registerAppleSpeechIpc(): void {
  if (process.platform !== "darwin") return;

  ipcMain.handle(
    BB_DESKTOP_APPLE_SPEECH_TRANSCRIBE_CHANNEL,
    async (_event, payload: unknown) => {
      const request = speechRequestSchema.parse(payload);
      if (request.audio.byteLength > MAX_AUDIO_BYTES) {
        throw new Error(
          "Voice recording is too large for on-device transcription.",
        );
      }

      const workingDirectory = await mkdtemp(
        join(tmpdir(), "axeai-apple-speech-"),
      );
      const audioPath = join(
        workingDirectory,
        `recording.${extensionForMimeType(request.mimeType)}`,
      );

      try {
        await writeFile(audioPath, request.audio);
        const args = ["--input", audioPath];
        if (request.locale) args.push("--locale", request.locale);
        if (request.context) args.push("--context", request.context);

        let stdout: string;
        try {
          ({ stdout } = await execFileAsync(resolveHelperPath(), args, {
            encoding: "utf8",
            maxBuffer: 1024 * 1024,
            timeout: 120_000,
          }));
        } catch (error) {
          const helperStdout =
            typeof error === "object" &&
            error !== null &&
            "stdout" in error &&
            typeof error.stdout === "string"
              ? error.stdout
              : "";
          if (helperStdout.trim()) {
            const output = parseHelperOutput(helperStdout);
            throw new Error(
              output.error ?? "Apple speech transcription failed.",
            );
          }
          throw error;
        }

        const output = parseHelperOutput(stdout);
        if (!output.text) {
          throw new Error(
            output.error ?? "Apple speech transcription returned no text.",
          );
        }
        return bbDesktopSpeechTranscriptionResultSchema.parse({
          text: output.text,
        });
      } finally {
        await rm(workingDirectory, { force: true, recursive: true });
      }
    },
  );
}
