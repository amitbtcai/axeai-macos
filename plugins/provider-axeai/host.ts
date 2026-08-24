// Keep the proven ACP coding bridge, adding AxeAI's host-local auth gate so a
// signed-out session is reported before OpenCode starts a thread.
export { axeAiProviderBridge as experimental_providerBridge } from "./src/host-bridge.js";
