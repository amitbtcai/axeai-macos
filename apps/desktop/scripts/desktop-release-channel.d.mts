export type DesktopReleaseChannel = "latest" | "nightly";
export type DesktopBuildPlatform = "macos" | "windows" | "linux";

export interface DesktopUpdateMetadataFileNames {
  linux: "latest-linux.yml" | "nightly-linux.yml";
  macos: "latest-mac.yml" | "nightly-mac.yml";
  windows: "latest.yml" | "nightly.yml";
}

export interface DesktopReleaseConfig {
  appId: "com.axeai.desktop" | "com.axeai.desktop.nightly";
  applicationName: "AxeAI" | "AxeAI Nightly";
  artifactName: string;
  iconFileName: "icon.png" | "icon-nightly.png";
  linuxExecutableName: "axeai" | "axeai-nightly";
  macIconPath: "assets/AxeAI.icon" | "assets/icon-nightly.icns";
  windowsIconPath: "assets/icon.ico" | "assets/icon-nightly.ico";
  releaseTag: "desktop-latest" | "desktop-nightly";
  updateMetadataFileNames: DesktopUpdateMetadataFileNames;
}

export function resolveDesktopReleaseChannel(
  env: NodeJS.ProcessEnv,
): DesktopReleaseChannel;

export function resolveDesktopBuildPlatform(
  nodePlatform: string,
): DesktopBuildPlatform;

export function createDesktopReleaseConfig(
  channel: DesktopReleaseChannel,
): DesktopReleaseConfig;

export function createDesktopUpdateReleaseBaseUrl(
  releaseTag: DesktopReleaseConfig["releaseTag"],
): string;
