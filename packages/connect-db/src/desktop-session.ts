const DEFAULT_DESKTOP_SESSION_TTL_MS = 60 * 60 * 1000;

function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function stringToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToString(value: string): string | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return new TextDecoder().decode(
      Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)),
    );
  } catch {
    return null;
  }
}

async function signDesktopSessionPayload(
  payload: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

async function verifySignedPayload(
  value: string,
  secret: string,
): Promise<unknown | null> {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  const expected = await signDesktopSessionPayload(payload, secret);
  if (signature.length !== expected.length) return null;
  let mismatch = 0;
  for (let index = 0; index < signature.length; index += 1) {
    mismatch |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  if (mismatch !== 0) return null;
  const decoded = base64UrlToString(payload);
  if (decoded === null) return null;
  try {
    return JSON.parse(decoded) as unknown;
  } catch {
    return null;
  }
}

export async function createDesktopSessionCookie(
  userId: string,
  secret: string,
  expiresAt: number = Date.now() + DEFAULT_DESKTOP_SESSION_TTL_MS,
): Promise<string> {
  const payload = stringToBase64Url(JSON.stringify({ expiresAt, userId }));
  return `${payload}.${await signDesktopSessionPayload(payload, secret)}`;
}

export async function verifyDesktopSessionCookie(
  cookieValue: string,
  secret: string,
  now: number = Date.now(),
): Promise<string | null> {
  const value = await verifySignedPayload(cookieValue, secret);
  if (
    typeof value !== "object" ||
    value === null ||
    !("userId" in value) ||
    typeof value.userId !== "string" ||
    !("expiresAt" in value) ||
    typeof value.expiresAt !== "number" ||
    value.expiresAt <= now
  ) {
    return null;
  }
  return value.userId;
}

export async function createAxeAiBootstrapSession(
  userId: string,
  serverId: string,
  secret: string,
  expiresAt: number,
): Promise<string> {
  const payload = stringToBase64Url(
    JSON.stringify({ expiresAt, purpose: "axeai-control", serverId, userId }),
  );
  return `${payload}.${await signDesktopSessionPayload(payload, secret)}`;
}

export async function verifyAxeAiBootstrapSession(
  value: string,
  secret: string,
  now: number = Date.now(),
): Promise<{ serverId: string; userId: string } | null> {
  const payload = await verifySignedPayload(value, secret);
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("purpose" in payload) ||
    payload.purpose !== "axeai-control" ||
    !("userId" in payload) ||
    typeof payload.userId !== "string" ||
    !("serverId" in payload) ||
    typeof payload.serverId !== "string" ||
    !("expiresAt" in payload) ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt <= now
  ) {
    return null;
  }
  return { serverId: payload.serverId, userId: payload.userId };
}
