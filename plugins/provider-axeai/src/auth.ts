import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import {
  AXEAI_AUTH_CALLBACK_PATH,
  AXEAI_OPENCODE_PROVIDER_ID,
  AXEAI_ORIGIN,
} from "./constants.js";

const execFileAsync = promisify(execFile);
const callbackSchema = z.object({
  code: z.string().min(32).max(128),
  state: z.string().min(32).max(128),
});
const exchangeSchema = z.object({
  refreshToken: z.string().regex(/^axe_refresh_[A-Za-z0-9_-]{43}$/),
  refreshExpiresAt: z.coerce.date(),
});
const authFileSchema = z.record(
  z.string(),
  z.object({ type: z.string(), key: z.string().optional() }).passthrough(),
);

function randomBase64Url(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

export function createPkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function openCodeAuthFilePath(env = process.env): string {
  const dataRoot =
    env.XDG_DATA_HOME?.trim() || path.join(os.homedir(), ".local", "share");
  return path.join(dataRoot, "opencode", "auth.json");
}

async function readAuthFile(
  filePath = openCodeAuthFilePath(),
): Promise<Record<string, unknown>> {
  try {
    const parsed = authFileSchema.safeParse(
      JSON.parse(await readFile(filePath, "utf8")),
    );
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

async function writeAuthFile(
  value: Record<string, unknown>,
  filePath = openCodeAuthFilePath(),
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${process.pid}.${randomBase64Url(6)}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

export interface AxeCredential {
  token: string;
  expiresAt: Date | null;
}

export async function readAxeCredential(): Promise<AxeCredential | null> {
  const auth = await readAuthFile();
  const entry = auth[AXEAI_OPENCODE_PROVIDER_ID];
  const parsed = z
    .object({
      type: z.literal("api"),
      key: z.string().min(1),
      expiresAt: z.coerce.date().optional(),
    })
    .safeParse(entry);
  return parsed.success
    ? { token: parsed.data.key, expiresAt: parsed.data.expiresAt ?? null }
    : null;
}

export async function readAxeToken(): Promise<string | null> {
  const credential = await readAxeCredential();
  return credential === null || axeCredentialIsExpired(credential)
    ? null
    : credential.token;
}

export function axeCredentialIsExpired(credential: AxeCredential): boolean {
  return (
    credential.expiresAt !== null &&
    credential.expiresAt.getTime() <= Date.now()
  );
}

export async function storeAxeToken(
  token: string,
  expiresAt?: Date,
): Promise<void> {
  const auth = await readAuthFile();
  await writeAuthFile({
    ...auth,
    [AXEAI_OPENCODE_PROVIDER_ID]: {
      type: "api",
      key: token,
      ...(expiresAt === undefined
        ? {}
        : { expiresAt: expiresAt.toISOString() }),
    },
  });
}

export async function removeAxeToken(): Promise<void> {
  const auth = await readAuthFile();
  delete auth[AXEAI_OPENCODE_PROVIDER_ID];
  await writeAuthFile(auth);
}

async function openBrowser(url: string): Promise<void> {
  if (process.platform === "darwin") {
    await execFileAsync("open", [url]);
    return;
  }
  if (process.platform === "win32") {
    await execFileAsync("rundll32", ["url.dll,FileProtocolHandler", url]);
    return;
  }
  await execFileAsync("xdg-open", [url]);
}

function waitForCallback(signal?: AbortSignal): Promise<{
  code: string;
  verifier: string;
}> {
  const verifier = randomBase64Url(48);
  const state = randomBase64Url(32);
  const challenge = createPkceChallenge(verifier);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, code?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      server.close();
      if (error) reject(error);
      else resolve({ code: code!, verifier });
    };
    const onAbort = () => finish(new Error("AxeAI login cancelled."));
    const server = createServer((request, response) => {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      if (requestUrl.pathname !== AXEAI_AUTH_CALLBACK_PATH) {
        response.writeHead(404).end();
        return;
      }
      const parsed = callbackSchema.safeParse({
        code: requestUrl.searchParams.get("code"),
        state: requestUrl.searchParams.get("state"),
      });
      if (!parsed.success || parsed.data.state !== state) {
        response.writeHead(400, {
          "content-type": "text/plain; charset=utf-8",
        });
        response.end("Invalid AxeAI login.");
        finish(new Error("Invalid AxeAI login callback."));
        return;
      }
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("AxeAI login complete.");
      finish(undefined, parsed.data.code);
    });
    const timeout = setTimeout(
      () => finish(new Error("AxeAI login timed out.")),
      5 * 60_000,
    );
    timeout.unref();
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    server.on("error", (error) => finish(error));
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        finish(new Error("AxeAI login callback could not start."));
        return;
      }
      const redirectUri = `http://127.0.0.1:${address.port}${AXEAI_AUTH_CALLBACK_PATH}`;
      const url = new URL("/native-auth", AXEAI_ORIGIN);
      url.searchParams.set("challenge", challenge);
      url.searchParams.set("client", "agent");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      void openBrowser(url.toString()).catch((error) => finish(error));
    });
  });
}

export async function loginToAxeAI(signal?: AbortSignal): Promise<void> {
  const { code, verifier } = await waitForCallback(signal);
  const response = await fetch(`${AXEAI_ORIGIN}/api/auth/native/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ code, verifier }),
    signal,
  });
  if (!response.ok) throw new Error("AxeAI login exchange failed.");
  const parsed = exchangeSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("AxeAI login exchange failed.");
  await storeAxeToken(parsed.data.refreshToken, parsed.data.refreshExpiresAt);
}
