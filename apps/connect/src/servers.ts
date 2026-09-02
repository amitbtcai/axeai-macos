import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  createDesktopSessionCookie,
  SERVER_OFFLINE_AFTER_MS,
  schema,
  server,
  type ConnectDb,
} from "@bb/connect-db";
import {
  parseCookie,
  verifyMachineCredential,
  verifySessionCookie,
} from "./session.js";
import { resolveConnectRuntime } from "./cloud-dev.js";
import { MACHINE_CREDENTIAL_HEADER } from "./protocol-headers.js";
import type { Env } from "./tunnel-do.js";

export {
  createDesktopSessionCookie,
  verifyAxeAiBootstrapSession,
  verifyDesktopSessionCookie,
} from "@bb/connect-db";

const DESKTOP_SESSION_TTL_MS = 60 * 60 * 1000;

const serverCredentialCache = new Map<
  string,
  { value: string | null; expires: number }
>();
const SERVER_CRED_TTL_MS = 20_000;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyServerCredential(
  credential: string,
  db: ConnectDb,
): Promise<string | null> {
  if (!credential) return null;
  const now = Date.now();
  const cached = serverCredentialCache.get(credential);
  if (cached && cached.expires > now) return cached.value;
  if (cached) serverCredentialCache.delete(credential);

  const hash = await sha256Hex(credential);
  const row = await db
    .select({ userId: server.userId })
    .from(server)
    .where(and(eq(server.credentialHash, hash), isNull(server.revokedAt)))
    .get();
  const userId = row?.userId ?? null;
  serverCredentialCache.set(credential, {
    value: userId,
    expires: now + SERVER_CRED_TTL_MS,
  });
  return userId;
}

export async function revokeServerCredential(
  credential: string,
  db: ConnectDb,
): Promise<{ subdomain: string } | null> {
  const presented = credential.trim();
  if (!presented) return null;

  const revoked = await db
    .update(server)
    .set({ credentialHash: null, revokedAt: new Date() })
    .where(
      and(
        eq(server.credentialHash, await sha256Hex(presented)),
        isNull(server.revokedAt),
      ),
    )
    .returning({ subdomain: server.subdomain })
    .get();
  serverCredentialCache.delete(presented);
  return revoked ?? null;
}

export async function resolveAccountUserId(
  request: Request,
  secret: string,
  db: ConnectDb,
  sessionCookieName: string,
): Promise<string | null> {
  const presented = request.headers.get(MACHINE_CREDENTIAL_HEADER) ?? "";
  if (presented) {
    const machineUserId = await verifyMachineCredential(presented, db);
    if (machineUserId) return machineUserId;
    const serverUserId = await verifyServerCredential(presented, db);
    if (serverUserId) return serverUserId;
  }

  const cookie = parseCookie(request.headers.get("cookie"), sessionCookieName);
  if (!cookie) return null;
  return verifySessionCookie(cookie, secret, db);
}

interface AccountServerListing {
  handle: string;
  name: string;
  live: boolean;
}

export async function listAccountServers(
  db: ConnectDb,
  userId: string,
  now: number = Date.now(),
): Promise<AccountServerListing[]> {
  const rows = await db
    .select({
      subdomain: server.subdomain,
      name: server.name,
      lastSeenAt: server.lastSeenAt,
      credentialHash: server.credentialHash,
      revokedAt: server.revokedAt,
    })
    .from(server)
    .where(eq(server.userId, userId))
    .all();

  return rows.map((row) => {
    const handle = row.subdomain;
    const trimmed = row.name.trim();
    const name = trimmed.length > 0 ? trimmed : handle;
    const connected = row.credentialHash != null && row.revokedAt == null;
    const lastSeenMs = row.lastSeenAt?.getTime() ?? null;
    const live =
      connected &&
      lastSeenMs != null &&
      now - lastSeenMs < SERVER_OFFLINE_AFTER_MS;
    return { handle, name, live };
  });
}

export async function handleListAccountServers(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: {
        "content-type": "application/json; charset=utf-8",
        allow: "GET",
      },
    });
  }

  const db = drizzle(env.DB, { schema });
  const runtime = resolveConnectRuntime(env);
  const userId = await resolveAccountUserId(
    request,
    env.BETTER_AUTH_SECRET,
    db,
    runtime.sessionCookieName,
  );
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const servers = await listAccountServers(db, userId);
  return new Response(JSON.stringify({ servers }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function handleDisconnectServer(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: {
        "content-type": "application/json; charset=utf-8",
        allow: "POST",
      },
    });
  }

  const db = drizzle(env.DB, { schema });
  const credential = request.headers.get(MACHINE_CREDENTIAL_HEADER) ?? "";
  const revoked = await revokeServerCredential(credential, db);
  if (!revoked) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  try {
    const stub = env.TUNNEL_DO.get(env.TUNNEL_DO.idFromName(revoked.subdomain));
    await stub.fetch("https://tunnel/__control/close");
  } catch {}
  return Response.json({ ok: true });
}

export async function handleCreateDesktopSession(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: {
        "content-type": "application/json; charset=utf-8",
        allow: "POST",
      },
    });
  }
  const db = drizzle(env.DB, { schema });
  const runtime = resolveConnectRuntime(env);
  const userId = await resolveAccountUserId(
    request,
    env.BETTER_AUTH_SECRET,
    db,
    runtime.sessionCookieName,
  );
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  const expiresAt = Date.now() + DESKTOP_SESSION_TTL_MS;
  const value = await createDesktopSessionCookie(
    userId,
    env.BETTER_AUTH_SECRET,
    expiresAt,
  );
  return new Response(
    JSON.stringify({
      cookie: {
        domain: `.${env.BASE_DOMAIN}`,
        expiresAt,
        name: runtime.desktopSessionCookieName,
        value,
      },
    }),
    {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    },
  );
}
