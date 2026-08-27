import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(desktopDirectory, "assets/icon.svg");
const png = join(desktopDirectory, "assets/icon.png");
const iconComposerLayer = join(
  desktopDirectory,
  "assets/AxeAI.icon/Assets/axeai-mark.svg",
);
const iconComposerDocument = join(desktopDirectory, "assets/AxeAI.icon");
const macosRuntimePng = join(desktopDirectory, "assets/icon-macos-runtime.png");
const windowsIcon = join(desktopDirectory, "assets/icon.ico");
const nightlyPng = join(desktopDirectory, "assets/icon-nightly.png");
const nightlyWindowsIcon = join(desktopDirectory, "assets/icon-nightly.ico");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "axeai-icon-"));
const renderedSource = join(temporaryDirectory, "icon-render.svg");

try {
  const renderedSourceText = readFileSync(source, "utf8").replaceAll(
    "currentColor",
    "#FFFFFF",
  );
  writeFileSync(renderedSource, renderedSourceText);
  const sourceBody = renderedSourceText
    .replace(/^<svg[^>]*>\s*/u, "")
    .replace(/\s*<\/svg>\s*$/u, "")
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
  mkdirSync(dirname(iconComposerLayer), { recursive: true });
  writeFileSync(
    iconComposerLayer,
    `<svg viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">\n  <svg x="227" y="252" width="570" height="520" viewBox="0 0 197 168" preserveAspectRatio="none">\n${sourceBody}\n  </svg>\n</svg>\n`,
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
  // Use Apple's renderer for development too. Production compiles the same
  // AxeAI.icon document through actool, eliminating the old split where dev
  // and packaged builds used differently scaled artwork.
  const developerDirectory = execFileSync("xcode-select", ["-p"], {
    encoding: "utf8",
  }).trim();
  const iconTool = resolve(
    developerDirectory,
    "..",
    "Applications",
    "Icon Composer.app",
    "Contents",
    "Executables",
    "ictool",
  );
  execFileSync(
    iconTool,
    [
      iconComposerDocument,
      "--export-image",
      "--output-file",
      macosRuntimePng,
      "--platform",
      "macOS",
      "--rendition",
      "Default",
      "--width",
      "1024",
      "--height",
      "1024",
      "--scale",
      "1",
    ],
    { stdio: "ignore" },
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
