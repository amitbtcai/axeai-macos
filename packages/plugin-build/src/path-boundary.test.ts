import { posix, win32 } from "node:path";
import { describe, expect, it } from "vitest";
import { isPathWithinRoot } from "./path-boundary.js";

describe("path boundary checks", () => {
  it.each([
    [posix, "/plugins/example", "/plugins/example/src/server.ts"],
    [win32, "D:\\plugins\\example", "D:\\plugins\\example\\src\\server.ts"],
  ] as const)(
    "accepts a child path with %s separators",
    (pathApi, root, child) => {
      expect(isPathWithinRoot(root, child, pathApi)).toBe(true);
    },
  );

  it.each([
    [posix, "/plugins/example", "/plugins/example-escape/server.ts"],
    [win32, "D:\\plugins\\example", "D:\\plugins\\example-escape\\server.ts"],
  ] as const)(
    "rejects a sibling path with %s separators",
    (pathApi, root, sibling) => {
      expect(isPathWithinRoot(root, sibling, pathApi)).toBe(false);
    },
  );
});
