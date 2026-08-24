import {
  experimental_defineProviderBridge,
  type ProviderBridgeEntry,
} from "@get-bb/plugin-sdk/provider-bridge";
import { experimental_acpProviderBridge as acpBridge } from "@get-bb/plugin-sdk/provider-bridge/acp";
import { axeCredentialIsExpired, readAxeCredential } from "./auth.js";

const AUTH_REQUIRED_MESSAGE = "ACP agent is not authenticated.";
const AUTH_GATED_METHODS = new Set([
  "model/list",
  "thread/start",
  "thread/resume",
  "thread/fork",
]);

interface BridgeRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
}

function decodeRequest(line: string): BridgeRequest | null {
  try {
    const value = JSON.parse(line) as Partial<BridgeRequest>;
    return value.jsonrpc === "2.0" &&
      (typeof value.id === "string" || typeof value.id === "number") &&
      typeof value.method === "string"
      ? (value as BridgeRequest)
      : null;
  } catch {
    return null;
  }
}

function sendResult(id: string | number, result: unknown): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function sendAuthRequired(id: string | number): void {
  process.stdout.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: AUTH_REQUIRED_MESSAGE },
    })}\n`,
  );
}

async function credentialStatus(): Promise<
  "ready" | "unauthenticated" | "expired"
> {
  const credential = await readAxeCredential();
  if (credential === null) return "unauthenticated";
  return axeCredentialIsExpired(credential) ? "expired" : "ready";
}

async function handleLine(line: string): Promise<void> {
  const request = decodeRequest(line);
  if (request === null) {
    acpBridge.handleLine(line);
    return;
  }
  if (request.method === "provider/health") {
    const status = await credentialStatus();
    sendResult(request.id, {
      supported: true,
      health: {
        status,
        statusMessage: null,
        accountEmail: null,
        planLabel: null,
        installedVersion: null,
        minimumSupportedVersion: null,
        canInstall: false,
        canUpdate: false,
        loginCommand: "bb axeai login",
      },
    });
    return;
  }
  if (
    AUTH_GATED_METHODS.has(request.method) &&
    (await credentialStatus()) !== "ready"
  ) {
    sendAuthRequired(request.id);
    return;
  }
  acpBridge.handleLine(line);
}

export const axeAiProviderBridge: ProviderBridgeEntry =
  experimental_defineProviderBridge({
    handleLine: (line) => void handleLine(line),
    start: acpBridge.start,
    onClose: acpBridge.onClose,
    onSigterm: acpBridge.onSigterm,
    onSigint: acpBridge.onSigint,
  });
