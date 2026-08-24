import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveDesktopBridgePath,
  resolveDesktopIconPath,
  type DesktopPathContext,
} from "../src/app-paths.js";

describe("desktop app paths", () => {
  it("resolves the packaged bb-app bridge beside the active asar", () => {
    const paths: DesktopPathContext = {
      appPath: "/Applications/bb.app/Contents/Resources/app.asar",
      isPackaged: true,
      resourcesPath: "/Applications/bb.app/Contents/Resources",
    };

    expect(resolveDesktopBridgePath({ paths })).toBe(
      join(`${paths.appPath}.unpacked`, "dist", "bb-app-bridge.mjs"),
    );
  });

  it("resolves the universal packaged bb-app bridge beside the selected arch asar", () => {
    const paths: DesktopPathContext = {
      appPath: "/Applications/bb.app/Contents/Resources/app-arm64.asar",
      isPackaged: true,
      resourcesPath: "/Applications/bb.app/Contents/Resources",
    };

    expect(resolveDesktopBridgePath({ paths })).toBe(
      join(`${paths.appPath}.unpacked`, "dist", "bb-app-bridge.mjs"),
    );
  });

  it("uses the release-specific icon inside packaged apps", () => {
    const paths: DesktopPathContext = {
      appPath: "/Applications/bb Nightly.app/Contents/Resources/app.asar",
      isPackaged: true,
      resourcesPath: "/Applications/bb Nightly.app/Contents/Resources",
    };

    expect(
      resolveDesktopIconPath({
        developmentIconFileName: "icon.icns",
        packagedIconFileName: "icon-nightly.png",
        paths,
      }),
    ).toBe(join(paths.appPath, "assets", "icon-nightly.png"));
  });

  it("uses the production macOS icon during development", () => {
    const paths: DesktopPathContext = {
      appPath: "/checkout/apps/desktop",
      isPackaged: false,
      resourcesPath: "/checkout/apps/desktop",
    };

    expect(
      resolveDesktopIconPath({
        developmentIconFileName: "icon-macos-runtime.png",
        packagedIconFileName: "icon-nightly.png",
        paths,
      }),
    ).toBe(join(paths.appPath, "assets", "icon-macos-runtime.png"));
  });

  it("supports the production PNG during non-macOS development", () => {
    const paths: DesktopPathContext = {
      appPath: "/checkout/apps/desktop",
      isPackaged: false,
      resourcesPath: "/checkout/apps/desktop",
    };

    expect(
      resolveDesktopIconPath({
        developmentIconFileName: "icon.png",
        packagedIconFileName: "icon-nightly.png",
        paths,
      }),
    ).toBe(join(paths.appPath, "assets", "icon.png"));
  });
});
