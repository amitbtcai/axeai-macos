import { and, eq, gt, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  MAX_PER_ACCOUNT,
  SERVER_OFFLINE_AFTER_MS,
  account,
  auditLog,
  checkLabelAvailability,
  connectCode,
  profile,
  schema,
  server,
  user,
} from "@bb/connect-db";
import type { Env } from "./tunnel-do.js";

const CLOUD_CODE_TTL_MS = 60 * 60 * 1000;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function authorized(request: Request, env: Env): boolean {
  const expected = env.CLOUD_PROVISIONING_SECRET?.trim();
  return (
    expected !== undefined &&
    expected !== "" &&
    request.headers.get("authorization") === `Bearer ${expected}`
  );
}

function connectCodeValue(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
}

function labelBase(email: string): string {
  const base = email
    .split("@")[0]
    ?.toLowerCase()
    .replace(/[^a-z0-9-]/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 24);
  return base && base.length >= 3 ? base : "axeai-user";
}

async function availableLabel(
  db: ReturnType<typeof drizzle<typeof schema>>,
  base: string,
): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6);
    const candidate = `${base.slice(0, 24)}-${suffix}`;
    const availability = await checkLabelAvailability(db, candidate);
    if (availability.available) return availability.label;
  }
  throw new Error("label-unavailable");
}

async function resolveLocalUser(
  db: ReturnType<typeof drizzle<typeof schema>>,
  owner: { id: string; email: string; name: string },
): Promise<string> {
  const existing = await db
    .select({ userId: account.userId })
    .from(account)
    .where(
      and(eq(account.providerId, "axeai"), eq(account.accountId, owner.id)),
    )
    .get();
  if (existing) return existing.userId;
  const email = owner.email.toLowerCase();
  const emailUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .get();
  const localUserId = emailUser?.id ?? crypto.randomUUID();
  const now = new Date();
  if (!emailUser) {
    await db
      .insert(user)
      .values({
        id: localUserId,
        name: owner.name,
        email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
  await db
    .insert(account)
    .values({
      id: crypto.randomUUID(),
      accountId: owner.id,
      providerId: "axeai",
      userId: localUserId,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return localUserId;
}

async function deploymentServer(
  env: Env,
  owner: { id: string; email: string; name: string },
  deploymentId: string,
) {
  const db = drizzle(env.DB, { schema });
  const existing = await db
    .select()
    .from(server)
    .where(eq(server.cloudDeploymentId, deploymentId))
    .get();
  if (existing) {
    const mapping = await db
      .select({ accountId: account.accountId })
      .from(account)
      .where(
        and(
          eq(account.userId, existing.userId),
          eq(account.providerId, "axeai"),
        ),
      )
      .get();
    if (mapping?.accountId !== owner.id) throw new Error("owner-mismatch");
    return { db, server: existing };
  }
  const localUserId = await resolveLocalUser(db, owner);
  const owned = await db
    .select({ id: server.id })
    .from(server)
    .where(eq(server.userId, localUserId))
    .all();
  if (owned.length >= MAX_PER_ACCOUNT) throw new Error("server-limit");
  let prof = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, localUserId))
    .get();
  const now = new Date();
  if (!prof) {
    const handle = await availableLabel(db, labelBase(owner.email));
    await db
      .insert(profile)
      .values({ userId: localUserId, handle, createdAt: now })
      .run();
    prof = { userId: localUserId, handle, createdAt: now };
  }
  const subdomain =
    owned.length === 0
      ? prof.handle
      : await availableLabel(db, `${prof.handle.slice(0, 22)}-cloud`);
  const id = crypto.randomUUID();
  await db
    .insert(server)
    .values({
      id,
      userId: localUserId,
      name: "AxeAI Cloud Computer",
      subdomain,
      cloudDeploymentId: deploymentId,
      createdAt: now,
    })
    .run();
  const created = await db.select().from(server).where(eq(server.id, id)).get();
  if (!created) throw new Error("server-create-failed");
  return { db, server: created };
}

export async function handleCloudProvisioning(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
  const url = new URL(request.url);
  if (request.method === "GET" || request.method === "DELETE") {
    const deploymentId = url.searchParams.get("deploymentId")?.trim();
    if (!deploymentId) return json({ error: "invalid-request" }, 400);
    const db = drizzle(env.DB, { schema });
    const srv = await db
      .select()
      .from(server)
      .where(eq(server.cloudDeploymentId, deploymentId))
      .get();
    if (!srv) return json({ error: "not-found" }, 404);
    if (request.method === "DELETE") {
      await db
        .insert(auditLog)
        .values({
          id: crypto.randomUUID(),
          userId: srv.userId,
          action: "cloud_app_deployment_unlinked",
          createdAt: new Date(),
        })
        .run();
      await db.delete(server).where(eq(server.id, srv.id)).run();
      return json({ ok: true });
    }
    const lastSeenAt = srv.lastSeenAt?.getTime() ?? null;
    return json({
      serverId: srv.id,
      remoteUrl: `https://${srv.subdomain}.${env.BASE_DOMAIN}`,
      paired: srv.credentialHash !== null && srv.revokedAt === null,
      online:
        srv.credentialHash !== null &&
        srv.revokedAt === null &&
        lastSeenAt !== null &&
        Date.now() - lastSeenAt < SERVER_OFFLINE_AFTER_MS,
    });
  }
  if (request.method !== "POST")
    return json({ error: "method-not-allowed" }, 405);
  const body = (await request.json().catch(() => null)) as {
    deploymentId?: unknown;
    owner?: { id?: unknown; email?: unknown; name?: unknown };
  } | null;
  if (
    typeof body?.deploymentId !== "string" ||
    typeof body.owner?.id !== "string" ||
    typeof body.owner.email !== "string" ||
    typeof body.owner.name !== "string"
  ) {
    return json({ error: "invalid-request" }, 400);
  }
  try {
    const result = await deploymentServer(
      env,
      {
        id: body.owner.id,
        email: body.owner.email,
        name: body.owner.name,
      },
      body.deploymentId,
    );
    const now = new Date();
    const openCode = await result.db
      .select()
      .from(connectCode)
      .where(
        and(
          eq(connectCode.serverId, result.server.id),
          eq(connectCode.purpose, "server-pair"),
          isNull(connectCode.consumedAt),
          gt(connectCode.expiresAt, now),
        ),
      )
      .get();
    const code = openCode?.code ?? connectCodeValue();
    if (!openCode) {
      await result.db
        .insert(connectCode)
        .values({
          code,
          userId: result.server.userId,
          serverId: result.server.id,
          purpose: "server-pair",
          expiresAt: new Date(now.getTime() + CLOUD_CODE_TTL_MS),
          createdAt: now,
        })
        .run();
    }
    return json({
      serverId: result.server.id,
      remoteUrl: `https://${result.server.subdomain}.${env.BASE_DOMAIN}`,
      connectCode: code,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "provisioning-failed" },
      409,
    );
  }
}
