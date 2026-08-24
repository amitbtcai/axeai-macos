import { describe, expect, it } from "vitest";
import { createPkceChallenge, openCodeAuthFilePath } from "./auth.js";

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
});
