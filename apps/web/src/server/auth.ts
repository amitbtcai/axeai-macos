import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/d1";
import { genericOAuth } from "better-auth/plugins";
import {
  account,
  CONNECT_SESSION_EXPIRES_IN_SECONDS,
  CONNECT_SESSION_UPDATE_AGE_SECONDS,
  session,
  user,
  verification,
} from "@bb/connect-db";
import type { Env } from "./env.js";
import { resolveDevEmailPasswordEnabled } from "./local-auth.js";

export type Auth = ReturnType<typeof createAuth>;

/**
 * Better Auth bound to Cloud D1 for application sessions. Production identity
 * comes from the canonical AxeAI OIDC provider; local Cloud additionally
 * enables email/password credentials.
 * Cookies are scoped to the shared parent of APP_URL and BASE_DOMAIN so a
 * dashboard on app.axeai.com can authenticate the gate on remote.axeai.com.
 */
export function createAuth(env: Env) {
  const db = drizzle(env.DB);
  const appUrl = new URL(env.APP_URL);
  const devEmailPasswordEnabled = resolveDevEmailPasswordEnabled(env);
  const axeaiIssuer = (env.AXEAI_AUTH_ISSUER ?? "https://axeai.com/api/auth")
    .replace(/\/$/u, "");
  const axeaiClientId = env.AXEAI_AUTH_CLIENT_ID ?? "axeai-remote-web";
  const subdomainOrigin = `${appUrl.protocol}//*.${env.BASE_DOMAIN}${
    appUrl.port ? `:${appUrl.port}` : ""
  }`;
  const appLabels = appUrl.hostname.split(".");
  const baseLabels = env.BASE_DOMAIN.split(".");
  const sharedLabels: string[] = [];
  while (
    appLabels.length > 0 &&
    baseLabels.length > 0 &&
    appLabels.at(-1) === baseLabels.at(-1)
  ) {
    const sharedLabel = appLabels.pop();
    if (sharedLabel === undefined) break;
    sharedLabels.unshift(sharedLabel);
    baseLabels.pop();
  }
  const cookieDomain = sharedLabels.length >= 2
    ? sharedLabels.join(".")
    : env.BASE_DOMAIN;
  return betterAuth({
    appName: "Axe AI Connect",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    trustedOrigins: [env.APP_URL, subdomainOrigin],
    // `better-auth` and `@better-auth/drizzle-adapter` resolve to two copies of
    // `@better-auth/core` under pnpm (different peer hashes — workers-types is in
    // one peer set), so the adapter's type is nominally distinct though identical
    // at runtime. Cast across that boundary to the option's own database type.
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: { user, session, account, verification },
    }) as unknown as Parameters<typeof betterAuth>[0]["database"],
    session: {
      expiresIn: CONNECT_SESSION_EXPIRES_IN_SECONDS,
      updateAge: CONNECT_SESSION_UPDATE_AGE_SECONDS,
    },
    emailAndPassword: { enabled: devEmailPasswordEnabled },
    user: {
      additionalFields: {
        githubLogin: { type: "string", required: false, input: false },
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["axeai"],
        updateUserInfoOnLink: true,
      },
    },
    plugins: [
      genericOAuth({
        config: [{
          providerId: "axeai",
          discoveryUrl: `${axeaiIssuer}/.well-known/openid-configuration`,
          issuer: axeaiIssuer,
          requireIssuerValidation: true,
          clientId: axeaiClientId,
          redirectURI: `${env.APP_URL}/api/auth/oauth2/callback/axeai`,
          scopes: ["openid", "profile", "email"],
          pkce: true,
        }],
      }),
    ],
    advanced: {
      crossSubDomainCookies: { enabled: true, domain: `.${cookieDomain}` },
    },
  });
}
