import { describe, expect, it } from "vitest";
import { resolveBbDesktopPlatform } from "../src/desktop-platform.js";

describe("desktop platform mapping", () => {
  it.each([
    ["darwin", "macos"],
    ["win32", "windows"],
    ["linux", "linux"],
  ] as const)("maps Node %s to desktop %s", (nodePlatform, desktopPlatform) => {
    expect(resolveBbDesktopPlatform(nodePlatform)).toBe(desktopPlatform);
  });

  it("rejects unsupported operating systems instead of reporting Linux", () => {
    expect(() => resolveBbDesktopPlatform("aix")).toThrow(
      "Unsupported desktop platform: aix",
    );
  });
});
