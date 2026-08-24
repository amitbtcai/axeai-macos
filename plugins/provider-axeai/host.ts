// Build the proven ACP coding bridge into this plugin's own host artifact.
// The runtime package has no dependency on the provider-acp plugin being
// installed or enabled.
export { experimental_providerBridge } from "../provider-acp/src/bridge/bridge.js";
