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
const renderedMacosIcon = join(temporaryDirectory, "icon-macos-icon.png");
const renderedMacosDockSource = join(temporaryDirectory, "icon-macos-dock.png");
const renderedMacosDockIcon = join(
  temporaryDirectory,
  "icon-macos-dock-icon.png",
);
const renderedMacosDockFinished = join(
  temporaryDirectory,
  "icon-macos-dock-finished.png",
);

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
  // Electron's app.dock.setIcon rendering enlarges the foreground mark
  // relative to the same artwork embedded in an ICNS. Compensate for that
  // macOS-specific path so development and packaged apps match in the Dock.
  execFileSync("magick", [
    "-size",
    "1024x1024",
    "xc:#060AE6",
    "(",
    "-background",
    "none",
    renderedSource,
    "-resize",
    "570x520!",
    ")",
    "-gravity",
    "center",
    "-composite",
    "-alpha",
    "off",
    "-strip",
    "-define",
    "png:exclude-chunks=date,time",
    renderedMacosDockSource,
  ]);
  // macOS displays the artwork embedded in an ICNS without adding the optical
  // inset used by Apple's own icons. Bake the rounded 100px inset into the
  // packaged ICNS artwork first.
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
    renderedMacosIcon,
  ]);
  execFileSync("magick", [
    renderedMacosDockSource,
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
    renderedMacosDockIcon,
  ]);
  // Bundle icons receive a restrained edge highlight from macOS. The raw
  // NSImage supplied through app.dock.setIcon bypasses that treatment, so add
  // the same one-pixel-at-Dock-size rim to the development artwork itself.
  execFileSync("magick", [
    renderedMacosDockIcon,
    "-fill",
    "none",
    "-stroke",
    "rgba(255,255,255,0.20)",
    "-strokewidth",
    "8",
    "-draw",
    "roundrectangle 104,104 919,919 181,181",
    "-strip",
    "-define",
    "png:exclude-chunks=date,time",
    renderedMacosDockFinished,
  ]);
  // Electron normalizes a raw Dock PNG to its non-transparent alpha bounds,
  // which would remove the 100px optical inset and visibly enlarge the icon.
  // A practically invisible full-canvas alpha extent prevents that crop while
  // leaving the rendered Dock pixels indistinguishable from transparency.
  execFileSync("magick", [
    "-size",
    "1024x1024",
    "xc:#060AE601",
    renderedMacosDockFinished,
    "-compose",
    "over",
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
      renderedMacosIcon,
      "--out",
      join(iconset, fileName),
    ]);
  }
  execFileSync("iconutil", ["-c", "icns", iconset, "-o", icns]);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
