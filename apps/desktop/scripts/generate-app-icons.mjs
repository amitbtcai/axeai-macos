import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(desktopDirectory, "assets/icon.svg");
const png = join(desktopDirectory, "assets/icon.png");
const macosRuntimePng = join(desktopDirectory, "assets/icon-macos-runtime.png");
const windowsIcon = join(desktopDirectory, "assets/icon.ico");
const nightlyPng = join(desktopDirectory, "assets/icon-nightly.png");
const nightlyWindowsIcon = join(desktopDirectory, "assets/icon-nightly.ico");
const icns = join(desktopDirectory, "assets/icon.icns");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "axeai-icon-"));
const iconset = join(temporaryDirectory, "icon.iconset");
const renderedSource = join(temporaryDirectory, "icon-render.svg");
const renderedMacosSource = join(temporaryDirectory, "icon-macos.png");

const variants = [
  [16, "icon_16x16.png"],
  [32, "icon_16x16@2x.png"],
  [32, "icon_32x32.png"],
  [64, "icon_32x32@2x.png"],
  [128, "icon_128x128.png"],
  [256, "icon_128x128@2x.png"],
  [256, "icon_256x256.png"],
  [512, "icon_256x256@2x.png"],
  [512, "icon_512x512.png"],
  [1024, "icon_512x512@2x.png"],
];

try {
  execFileSync("mkdir", ["-p", iconset]);
  writeFileSync(
    renderedSource,
    readFileSync(source, "utf8").replaceAll("currentColor", "#FFFFFF"),
  );
  execFileSync("magick", [
    "-size",
    "1024x1024",
    "xc:#060AE6",
    "(",
    "-background",
    "none",
    renderedSource,
    "-resize",
    "700x700",
    ")",
    "-gravity",
    "center",
    "-composite",
    "-alpha",
    "off",
    "-strip",
    "-define",
    "png:exclude-chunks=date,time",
    png,
  ]);
  execFileSync("magick", [
    png,
    "-define",
    "icon:auto-resize=256,128,64,48,32,16",
    windowsIcon,
  ]);
  execFileSync("magick", [
    nightlyPng,
    "-define",
    "icon:auto-resize=256,128,64,48,32,16",
    nightlyWindowsIcon,
  ]);
  // Keep the full-bleed blue macOS background unchanged. Only reduce the
  // white AxeAI SVG's vertical scale so the mark feels less tall without
  // shrinking the app icon itself.
  execFileSync("magick", [
    "-size",
    "1024x1024",
    "xc:#060AE6",
    "(",
    "-background",
    "none",
    renderedSource,
    "-resize",
    "700x630!",
    ")",
    "-gravity",
    "center",
    "-composite",
    "-alpha",
    "off",
    "-strip",
    "-define",
    "png:exclude-chunks=date,time",
    renderedMacosSource,
  ]);
  // macOS applies its rounded mask and optical inset when it loads the packaged
  // ICNS from the bundle. Electron's development-only dock.setIcon override
  // skips that pipeline, so bake both into the runtime PNG. The 100px inset
  // matches the apparent size of the production icon in a 1024px Dock tile.
  execFileSync("magick", [
    renderedMacosSource,
    "(",
    "-size",
    "1024x1024",
    "xc:none",
    "-fill",
    "white",
    "-draw",
    "roundrectangle 100,100 923,923 185,185",
    ")",
    "-alpha",
    "off",
    "-compose",
    "CopyOpacity",
    "-composite",
    "-strip",
    "-define",
    "png:exclude-chunks=date,time",
    macosRuntimePng,
  ]);
  for (const [size, fileName] of variants) {
    execFileSync("sips", [
      "-z",
      String(size),
      String(size),
      renderedMacosSource,
      "--out",
      join(iconset, fileName),
    ]);
  }
  execFileSync("iconutil", ["-c", "icns", iconset, "-o", icns]);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
