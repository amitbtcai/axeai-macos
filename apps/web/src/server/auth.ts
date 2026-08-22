import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/d1";
import { account, session, user, verification } from "@bb/connect-db";
import type { Env } from "./env.js";
import { resolveDevEmailPasswordEnabled } from "./local-auth.js";

export type Auth = ReturnType<typeof createAuth>;

/**
 * better-auth bound to the Cloud D1 via drizzle. Production uses GitHub;
 * local Cloud additionally enables email/password credentials.
 * Cookies are scoped to the shared parent of APP_URL and BASE_DOMAIN so a
 * dashboard on app.axeai.com can authenticate the gate on remote.axeai.com.
 */
export function createAuth(env: Env) {
  const db = drizzle(env.DB);
  const appUrl = new URL(env.APP_URL);
  const devEmailPasswordEnabled = resolveDevEmailPasswordEnabled(env);
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
    emailAndPassword: { enabled: devEmailPasswordEnabled },
    user: {
      additionalFields: {
        githubLogin: { type: "string", required: false, input: false },
      },
    },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        overrideUserInfoOnSignIn: true,
        mapProfileToUser: (profile) => ({ githubLogin: profile.login }),
      },
    },
    advanced: {
      crossSubDomainCookies: { enabled: true, domain: `.${cookieDomain}` },
    },
  });
}
