import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createPkceChallenge,
  openCodeAuthFilePath,
  readAxeCredential,
  readAxeToken,
  storeAxeToken,
} from "./auth.js";

const originalXdgDataHome = process.env.XDG_DATA_HOME;

afterEach(() => {
  if (originalXdgDataHome === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = originalXdgDataHome;
});

describe("AxeAI agent authentication", () => {
  it("uses the RFC 7636 S256 challenge", () => {
    expect(
      createPkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("uses OpenCode's XDG credential location", () => {
    expect(openCodeAuthFilePath({ XDG_DATA_HOME: "/tmp/axeai-data" })).toBe(
      "/tmp/axeai-data/opencode/auth.json",
    );
  });

  it("stores the backend expiry alongside OpenCode's API credential", async () => {
    process.env.XDG_DATA_HOME = await mkdtemp(
      path.join(os.tmpdir(), "axeai-auth-"),
    );
    const expiresAt = new Date("2030-01-02T03:04:05.000Z");

    await storeAxeToken("axe_refresh_test", expiresAt);

    await expect(readAxeCredential()).resolves.toEqual({
      token: "axe_refresh_test",
      expiresAt,
    });
    const stored = JSON.parse(await readFile(openCodeAuthFilePath(), "utf8"));
    expect(stored.axeai).toEqual({
      type: "api",
      key: "axe_refresh_test",
      expiresAt: expiresAt.toISOString(),
    });
  });

  it("does not expose an expired credential to API callers", async () => {
    process.env.XDG_DATA_HOME = await mkdtemp(
      path.join(os.tmpdir(), "axeai-auth-"),
    );
    await storeAxeToken("axe_refresh_expired", new Date(0));

    await expect(readAxeToken()).resolves.toBeNull();
  });
});
