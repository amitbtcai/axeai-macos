import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") {
  process.stdout.write("Skipping macOS app icon verification outside macOS.\n");
  process.exit(0);
}

const desktopDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDirectory = join(desktopDirectory, "assets");
const composerIcon = join(assetsDirectory, "AxeAI.icon");
const runtimeIcon = join(assetsDirectory, "icon-macos-runtime.png");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "axeai-icon-verify-"));
const iconset = join(temporaryDirectory, "icon.iconset");

const variants = [
  "icon_16x16.png",
  "icon_16x16@2x.png",
  "icon_128x128.png",
  "icon_128x128@2x.png",
];

function run(command, args) {
  execFileSync(command, args, { stdio: "ignore" });
}

try {
  const composerInput = join(temporaryDirectory, "Icon.icon");
  const composerOutput = join(temporaryDirectory, "composer-output");
  cpSync(composerIcon, composerInput, { recursive: true });
  mkdirSync(composerOutput);
  run("xcrun", [
    "actool",
    composerInput,
    "--compile",
    composerOutput,
    "--output-format",
    "human-readable-text",
    "--notices",
    "--warnings",
    "--output-partial-info-plist",
    join(composerOutput, "assetcatalog_generated_info.plist"),
    "--app-icon",
    "Icon",
    "--include-all-app-icons",
    "--accent-color",
    "AccentColor",
    "--enable-on-demand-resources",
    "NO",
    "--development-region",
    "en",
    "--target-device",
    "mac",
    "--minimum-deployment-target",
    "26.0",
    "--platform",
    "macosx",
  ]);
  if (
    !existsSync(join(composerOutput, "Assets.car")) ||
    !existsSync(join(composerOutput, "Icon.icns"))
  ) {
    throw new Error(
      "Apple actool did not produce both the layered catalog and legacy fallback icon",
    );
  }

  run("iconutil", [
    "-c",
    "iconset",
    join(composerOutput, "Icon.icns"),
    "-o",
    iconset,
  ]);
  for (const fileName of variants) {
    if (!existsSync(join(iconset, fileName))) {
      throw new Error(`Layered icon fallback is missing ${fileName}`);
    }
  }

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
  const expectedRuntimeIcon = join(temporaryDirectory, "runtime.png");
  run(iconTool, [
    composerIcon,
    "--export-image",
    "--output-file",
    expectedRuntimeIcon,
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
  ]);
  run("magick", [
    "compare",
    "-metric",
    "AE",
    "-fuzz",
    "1%",
    expectedRuntimeIcon,
    runtimeIcon,
    "null:",
  ]);

  process.stdout.write(
    "Verified the layered Apple icon, legacy fallback sizes, and development Dock artwork.\n",
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
