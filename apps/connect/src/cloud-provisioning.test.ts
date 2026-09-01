import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleCloudProvisioning } from "./cloud-provisioning.js";
import type { Env } from "./tunnel-do.js";

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../../packages/connect-db/migrations", import.meta.url),
);
const SECRET = "cloud-provisioning-test-secret";

let mf: Miniflare;
let env: Env;

function request(
  method: string,
  deploymentId = "deployment-1",
  body?: unknown,
) {
  const url = new URL(
    "https://api.remote.axeai.com/api/connect/cloud-provisioning",
  );
  if (method !== "POST") url.searchParams.set("deploymentId", deploymentId);
  return new Request(url, {
    method,
    headers: {
      authorization: `Bearer ${SECRET}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function migrationStatements(source: string): string[] {
  const statements: string[] = [];
  let lines: string[] = [];
  let trigger = false;
  for (const line of source
    .replaceAll("--> statement-breakpoint", "")
    .split("\n")) {
    if (line.trimStart().startsWith("--") || line.trim() === "") continue;
    if (lines.length === 0) trigger = /^CREATE TRIGGER\b/u.test(line.trim());
    lines.push(line);
    if (
      (trigger && line.trim() === "END;") ||
      (!trigger && line.trim().endsWith(";"))
    ) {
      statements.push(lines.join("\n"));
      lines = [];
      trigger = false;
    }
  }
  if (lines.length > 0) statements.push(lines.join("\n"));
  return statements;
}

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
    compatibilityDate: "2026-06-11",
    d1Databases: { DB: "cloud-provisioning-test" },
  });
  await mf.ready;
  const db = await mf.getD1Database("DB");
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    if (file.endsWith(".sql")) {
      const statements = migrationStatements(
        readFileSync(join(MIGRATIONS_DIR, file), "utf8"),
      );
      await db.batch(statements.map((statement) => db.prepare(statement)));
    }
  }
  env = {
    DB: db,
    BASE_DOMAIN: "remote.axeai.test",
    CLOUD_PROVISIONING_SECRET: SECRET,
  } as Env;
});

afterAll(async () => {
  await mf.dispose();
});

describe("Cloud Computer Remote Access provisioning", () => {
  it("idempotently provisions, reports, and removes one deployment", async () => {
    const body = {
      deploymentId: "deployment-1",
      owner: { id: "axeai-owner-1", email: "owner@example.com", name: "Owner" },
    };
    const first = await handleCloudProvisioning(
      request("POST", "deployment-1", body),
      env,
    );
    expect(first.status).toBe(200);
    const provisioned = await first.json<{
      serverId: string;
      remoteUrl: string;
      connectCode: string;
    }>();
    expect(provisioned.remoteUrl).toMatch(
      /^https:\/\/owner-[a-z0-9]+\.remote\.axeai\.test$/u,
    );
    expect(provisioned.connectCode).toHaveLength(8);

    const repeated = await handleCloudProvisioning(
      request("POST", "deployment-1", body),
      env,
    );
    expect(repeated.status).toBe(200);
    expect((await repeated.json<{ serverId: string }>()).serverId).toBe(
      provisioned.serverId,
    );

    const status = await handleCloudProvisioning(request("GET"), env);
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      serverId: provisioned.serverId,
      paired: false,
      online: false,
    });

    const removed = await handleCloudProvisioning(request("DELETE"), env);
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ ok: true });
    expect((await handleCloudProvisioning(request("GET"), env)).status).toBe(
      404,
    );

    const db = await mf.getD1Database("DB");
    const audit = await db
      .prepare("select action from audit_log where action = ?")
      .bind("cloud_app_deployment_unlinked")
      .first<{ action: string }>();
    expect(audit?.action).toBe("cloud_app_deployment_unlinked");
  });

  it("rejects requests without the shared service secret", async () => {
    const response = await handleCloudProvisioning(
      new Request(
        "https://api.remote.axeai.com/api/connect/cloud-provisioning",
      ),
      env,
    );
    expect(response.status).toBe(401);
  });
});
