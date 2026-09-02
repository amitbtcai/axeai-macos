import {
  buildTerminalWebSocketPath,
  type BuildTerminalWebSocketPathArgs,
} from "@bb/client-core";
import { buildDevWebSocketUrl } from "@/lib/dev-websocket-url";
import { appServerOrigin } from "@/lib/embedded-runtime";

type BuildTerminalWebSocketUrlArgs = BuildTerminalWebSocketPathArgs;

function buildWebSocketUrl(path: string): string {
  const devWebSocketUrl = buildDevWebSocketUrl({ path });
  if (devWebSocketUrl !== undefined) {
    return devWebSocketUrl;
  }

  const serverOrigin = new URL(appServerOrigin());
  const protocol = serverOrigin.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${serverOrigin.host}${path}`;
}

export function buildTerminalWebSocketUrl(
  args: BuildTerminalWebSocketUrlArgs,
): string {
  return buildWebSocketUrl(buildTerminalWebSocketPath(args));
}
