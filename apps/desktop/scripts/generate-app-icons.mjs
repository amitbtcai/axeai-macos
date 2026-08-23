import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(desktopDirectory, "assets/icon.svg");
const png = join(desktopDirectory, "assets/icon.png");
const developmentPng = join(desktopDirectory, "assets/icon-dev.png");
const windowsIcon = join(desktopDirectory, "assets/icon.ico");
const nightlyPng = join(desktopDirectory, "assets/icon-nightly.png");
const nightlyWindowsIcon = join(desktopDirectory, "assets/icon-nightly.ico");
const icns = join(desktopDirectory, "assets/icon.icns");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "axeai-icon-"));
const iconset = join(temporaryDirectory, "icon.iconset");
const renderedSource = join(temporaryDirectory, "icon-render.svg");

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
  copyFileSync(png, developmentPng);
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
  for (const [size, fileName] of variants) {
    execFileSync("sips", [
      "-z",
      String(size),
      String(size),
      png,
      "--out",
      join(iconset, fileName),
    ]);
  }
  execFileSync("iconutil", ["-c", "icns", iconset, "-o", icns]);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
