import { describe, expect, it } from "vitest";
import { bbDesktopSpeechTranscriptionResultSchema } from "../src/speech.js";

describe("bbDesktopSpeechTranscriptionResultSchema", () => {
  it("rejects empty or unexpected native helper output", () => {
    expect(
      bbDesktopSpeechTranscriptionResultSchema.safeParse({ text: "hello" })
        .success,
    ).toBe(true);
    expect(
      bbDesktopSpeechTranscriptionResultSchema.safeParse({ text: "" }).success,
    ).toBe(false);
    expect(
      bbDesktopSpeechTranscriptionResultSchema.safeParse({
        text: "hello",
        command: "ignored",
      }).success,
    ).toBe(false);
  });
});
