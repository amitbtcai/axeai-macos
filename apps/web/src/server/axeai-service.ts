import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { account, schema, user } from "@bb/connect-db";
import type { Env } from "./env.js";

export interface AxeAiOwner {
  id: string;
  email: string;
  name: string;
}

export async function resolveAxeAiUser(
  env: Env,
  owner: AxeAiOwner,
): Promise<string> {
  const db = drizzle(env.DB, { schema });
  const existing = await db
    .select({ userId: account.userId })
    .from(account)
    .where(
      and(eq(account.providerId, "axeai"), eq(account.accountId, owner.id)),
    )
    .get();
  if (existing) return existing.userId;

  const email = owner.email.trim().toLowerCase();
  const emailUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .get();
  const userId = emailUser?.id ?? crypto.randomUUID();
  const now = new Date();
  if (!emailUser) {
    await db
      .insert(user)
      .values({
        id: userId,
        name: owner.name,
        email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
  await db
    .insert(account)
    .values({
      id: crypto.randomUUID(),
      accountId: owner.id,
      providerId: "axeai",
      userId,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return userId;
}
