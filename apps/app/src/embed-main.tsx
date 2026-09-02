import { installEmbeddedFetch } from "./lib/embedded-runtime";

type ControlSession = {
  serverId: string;
  serverUrl: string;
  session: string;
};

async function start(): Promise<void> {
  const serverId = new URLSearchParams(window.location.search).get("server");
  if (!serverId) throw new Error("remote_server_required");
  const response = await fetch("/api/remote-access/dashboard", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "create-control-session", serverId }),
  });
  if (!response.ok) throw new Error("remote_session_failed");
  const body = (await response.json()) as { data?: ControlSession };
  const control = body.data;
  if (!control || control.serverId !== serverId) {
    throw new Error("remote_session_invalid");
  }
  const serverUrl = new URL(control.serverUrl);
  if (
    serverUrl.protocol !== "https:" ||
    !serverUrl.hostname.endsWith(".remote.axeai.com") ||
    serverUrl.pathname !== "/"
  ) {
    throw new Error("remote_origin_invalid");
  }
  const exchange = await fetch(`${serverUrl.origin}/api/connect/axeai-session`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ session: control.session }),
  });
  if (!exchange.ok) throw new Error("remote_session_exchange_failed");

  const base = document.createElement("base");
  base.href = `${serverUrl.origin}/`;
  document.head.prepend(base);
  installEmbeddedFetch(serverUrl.origin);
  const { mountEmbeddedApp } = await import("./embedded-app-entry");
  mountEmbeddedApp();
}

void start();
