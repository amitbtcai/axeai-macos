const DESKTOP_RELEASE_CHANNEL_ENV_NAME = "BB_DESKTOP_RELEASE_CHANNEL";

export function resolveDesktopReleaseChannel(env) {
  const rawChannel = env[DESKTOP_RELEASE_CHANNEL_ENV_NAME]?.trim();
  if (rawChannel === undefined || rawChannel.length === 0) {
    return "latest";
  }
  if (rawChannel === "latest" || rawChannel === "nightly") {
    return rawChannel;
  }

  throw new Error(
    `${DESKTOP_RELEASE_CHANNEL_ENV_NAME} must be latest or nightly, got ${rawChannel}.`,
  );
}

export function resolveDesktopBuildPlatform(nodePlatform) {
  if (nodePlatform === "darwin") {
    return "macos";
  }
  if (nodePlatform === "linux") {
    return "linux";
  }
  if (nodePlatform === "win32") {
    return "windows";
  }

  throw new Error(
    `Desktop builds support darwin, win32, and linux only, got ${nodePlatform}.`,
  );
}

export function createDesktopReleaseConfig(channel) {
  if (channel === "nightly") {
    return {
      appId: "com.axeai.desktop.nightly",
      applicationName: "AxeAI Nightly",
      artifactName: "AxeAI-Nightly-${version}-${arch}.${ext}",
      iconFileName: "icon-nightly.png",
      // The Linux binary name must differ from stable so both channels can be
      // installed at once without one shadowing the other on PATH.
      linuxExecutableName: "axeai-nightly",
      macIconPath: "assets/icon-nightly.icns",
      windowsIconPath: "assets/icon-nightly.ico",
      releaseTag: "desktop-nightly",
      updateMetadataFileNames: {
        linux: "nightly-linux.yml",
        macos: "nightly-mac.yml",
        windows: "nightly.yml",
      },
    };
  }

  return {
    appId: "com.axeai.desktop",
    applicationName: "AxeAI",
    artifactName: "AxeAI-${version}-${arch}.${ext}",
    iconFileName: "icon.png",
    linuxExecutableName: "axeai",
    macIconPath: "assets/AxeAI.icon",
    windowsIconPath: "assets/icon.ico",
    releaseTag: "desktop-latest",
    updateMetadataFileNames: {
      linux: "latest-linux.yml",
      macos: "latest-mac.yml",
      windows: "latest.yml",
    },
  };
}

export function createDesktopUpdateReleaseBaseUrl(releaseTag) {
  return `https://github.com/amitbtcai/axeai-macos/releases/download/${releaseTag}/`;
}
