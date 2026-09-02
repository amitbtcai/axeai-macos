import { createApiClient } from "@bb/server-contract";
import { fetchWithAppSurface } from "./app-surface";
import { appServerOrigin } from "./embedded-runtime";

const client = createApiClient(appServerOrigin(), { fetch: fetchWithAppSurface });

export const apiClient = client.api.v1;

export function toRelativeUrl(url: URL): string {
  return `${url.pathname}${url.search}`;
}
