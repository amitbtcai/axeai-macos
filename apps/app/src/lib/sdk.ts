import { createBrowserBbSdk } from "@bb/sdk/browser";
import { fetchWithAppSurface } from "./app-surface";
import { appServerOrigin } from "./embedded-runtime";

export const sdk = createBrowserBbSdk({
  baseUrl: appServerOrigin(),
  fetch: fetchWithAppSurface,
});

export { BbHttpError } from "@bb/sdk/browser";
