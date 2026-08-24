import type { PluginAgentToolResult } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { readAxeToken } from "./auth.js";
import { AXEAI_ORIGIN } from "./constants.js";

const errorSchema = z
  .object({
    error: z.union([
      z.string(),
      z.object({ message: z.string().optional() }).passthrough(),
    ]).optional(),
    message: z.string().optional(),
  })
  .passthrough();

async function axeRequest(
  pathname: string,
  init: RequestInit,
): Promise<unknown> {
  const token = await readAxeToken();
  if (!token) throw new Error("AxeAI login required.");
  const response = await fetch(`${AXEAI_ORIGIN}${pathname}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      ...init.headers,
    },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = errorSchema.safeParse(body);
    const nested = parsed.success && typeof parsed.data.error === "object"
      ? parsed.data.error?.message
      : undefined;
    const direct = parsed.success && typeof parsed.data.error === "string"
      ? parsed.data.error
      : undefined;
    throw new Error(nested || direct || (parsed.success ? parsed.data.message : undefined) || `AxeAI request failed (${response.status}).`);
  }
  return body;
}

const imageResponseSchema = z.union([
  z.object({
    asset: z.object({
      url: z.string().min(1),
      model: z.string().optional(),
    }).passthrough(),
  }),
  z.object({
    data: z.array(z.object({ url: z.string().min(1) }).passthrough()).min(1),
  }),
]);

async function loadGeneratedImage(
  url: string,
  signal: AbortSignal,
): Promise<{ data: string; mimeType: string } | null> {
  const token = await readAxeToken();
  const response = await fetch(new URL(url, AXEAI_ORIGIN), {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    signal,
  });
  if (!response.ok) return null;
  const mimeType = response.headers.get("content-type")?.split(";", 1)[0] ?? "";
  if (!mimeType.startsWith("image/")) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 25 * 1024 * 1024) return null;
  return { data: Buffer.from(bytes).toString("base64"), mimeType };
}

export async function generateImage(input: {
  prompt: string;
  model?: string;
  signal: AbortSignal;
}): Promise<PluginAgentToolResult> {
  const body = await axeRequest("/v1/images/generations", {
    method: "POST",
    body: JSON.stringify({ prompt: input.prompt, model: input.model }),
    signal: input.signal,
  });
  const parsed = imageResponseSchema.parse(body);
  const rawUrl = "asset" in parsed ? parsed.asset.url : parsed.data[0]!.url;
  const url = new URL(rawUrl, AXEAI_ORIGIN).toString();
  const image = await loadGeneratedImage(url, input.signal).catch(() => null);
  return {
    content: [
      { type: "text", text: JSON.stringify({ url, model: input.model ?? null }) },
      ...(image ? [{ type: "image" as const, ...image }] : []),
    ],
  };
}

const videoJobSchema = z.object({
  id: z.string(),
  status: z.string(),
}).passthrough();
const nestedVideoCreateSchema = z.object({ job: videoJobSchema });
const videoStatusSchema = z.object({
  job: z.object({ id: z.string(), status: z.string(), error: z.string().optional() }).nullable(),
  asset: z.object({ url: z.string().min(1) }).passthrough().nullable(),
});

export async function generateVideo(input: {
  prompt: string;
  model?: string;
  wait: boolean;
  signal: AbortSignal;
}): Promise<PluginAgentToolResult> {
  const response = await axeRequest("/v1/videos/generations", {
    method: "POST",
    body: JSON.stringify({ prompt: input.prompt, model: input.model }),
    signal: input.signal,
  });
  const nested = nestedVideoCreateSchema.safeParse(response);
  const job = nested.success ? nested.data.job : videoJobSchema.parse(response);
  if (!input.wait) return JSON.stringify(job);

  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        input.signal.removeEventListener("abort", abort);
        resolve();
      }, 3_000);
      const abort = () => {
        clearTimeout(timeout);
        input.signal.removeEventListener("abort", abort);
        reject(input.signal.reason ?? new Error("Video generation cancelled."));
      };
      input.signal.addEventListener("abort", abort, { once: true });
    });
    const status = videoStatusSchema.parse(
      await axeRequest(`/v1/videos/jobs/${encodeURIComponent(job.id)}`, {
        method: "GET",
        signal: input.signal,
      }),
    );
    if (status.job?.status === "completed") {
      return JSON.stringify({
        ...status.job,
        url: status.asset?.url
          ? new URL(status.asset.url, AXEAI_ORIGIN).toString()
          : null,
      });
    }
    if (status.job?.status === "failed") {
      throw new Error(status.job.error || "AxeAI video generation failed.");
    }
  }
  return JSON.stringify({ id: job.id, status: "running" });
}
