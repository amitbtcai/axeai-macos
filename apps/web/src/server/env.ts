import { env as workerEnv } from "cloudflare:workers";

export interface Env {
  DB: D1Database;
  TUNNEL_DO: DurableObjectNamespace;
  BASE_DOMAIN: string;
  APP_URL: string;
  CONNECT_SERVER_URL_TEMPLATE?: string;
  DEV_EMAIL_PASSWORD_AUTH?: string;
  AXEAI_AUTH_ISSUER?: string;
  AXEAI_AUTH_CLIENT_ID?: string;
  BETTER_AUTH_SECRET: string;
  AXEAI_DASHBOARD_SERVICE_SECRET?: string;
  LANDING_POSTHOG_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_AUDIENCE_ID?: string;
  MARKETPLACE?: R2Bucket;
  ASSETLINKS_SHA256_FINGERPRINTS?: string;
}

export function getEnv(): Env {
  return workerEnv as unknown as Env;
}
