import { createFileRoute } from "@tanstack/react-router";
import {
  acceptAppAccessInvitation,
  checkAvailability,
  claimHandle,
  createAppAccessInvitation,
  createConnectCode,
  createServer,
  depsFromEnv,
  disconnectServer,
  getAccountState,
  removeServer,
  revokeAppAccessInvitation,
  revokeMachine,
} from "@/server/api";
import { resolveAxeAiUser, type AxeAiOwner } from "@/server/axeai-service";
import { getEnv } from "@/server/env";

type DashboardRequest = {
  action?: string;
  owner?: AxeAiOwner;
  label?: string;
  serverId?: string;
  machineId?: string;
  invitationId?: string;
  email?: string;
  token?: string;
  reuse?: boolean;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function validOwner(value: unknown): value is AxeAiOwner {
  if (!value || typeof value !== "object") return false;
  const owner = value as Record<string, unknown>;
  return (
    typeof owner.id === "string" &&
    owner.id.length > 0 &&
    typeof owner.email === "string" &&
    owner.email.includes("@") &&
    typeof owner.name === "string" &&
    owner.name.length > 0
  );
}

export const Route = createFileRoute("/api/internal/axeai-dashboard")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = getEnv();
        const expected = env.AXEAI_DASHBOARD_SERVICE_SECRET?.trim();
        if (
          !expected ||
          request.headers.get("authorization") !== `Bearer ${expected}`
        ) {
          return json({ error: "unauthorized" }, 401);
        }
        const body = (await request
          .json()
          .catch(() => null)) as DashboardRequest | null;
        if (
          !body ||
          !validOwner(body.owner) ||
          typeof body.action !== "string"
        ) {
          return json({ error: "invalid-request" }, 400);
        }
        const userId = await resolveAxeAiUser(env, body.owner);
        const deps = depsFromEnv(env);

        switch (body.action) {
          case "state":
            return json({ data: await getAccountState(deps, userId) });
          case "check-availability":
            return typeof body.label === "string"
              ? json({ data: await checkAvailability(deps, body.label) })
              : json({ error: "invalid-request" }, 400);
          case "claim-handle":
            return typeof body.label === "string"
              ? json({ data: await claimHandle(deps, userId, body.label) })
              : json({ error: "invalid-request" }, 400);
          case "create-server":
            return typeof body.label === "string"
              ? json({ data: await createServer(deps, userId, body.label) })
              : json({ error: "invalid-request" }, 400);
          case "create-code":
            return json({
              data: await createConnectCode(deps, userId, {
                serverId: body.serverId,
                reuse: body.reuse,
              }),
            });
          case "disconnect-server":
            return typeof body.serverId === "string"
              ? json({
                  data: await disconnectServer(deps, userId, body.serverId),
                })
              : json({ error: "invalid-request" }, 400);
          case "remove-server":
            return typeof body.serverId === "string"
              ? json({ data: await removeServer(deps, userId, body.serverId) })
              : json({ error: "invalid-request" }, 400);
          case "revoke-machine":
            return typeof body.machineId === "string"
              ? json({
                  data: await revokeMachine(deps, userId, body.machineId),
                })
              : json({ error: "invalid-request" }, 400);
          case "invite":
            return typeof body.serverId === "string" &&
              typeof body.email === "string"
              ? json({
                  data: await createAppAccessInvitation(deps, userId, {
                    serverId: body.serverId,
                    email: body.email,
                  }),
                })
              : json({ error: "invalid-request" }, 400);
          case "accept-invite":
            return typeof body.token === "string"
              ? json({
                  data: await acceptAppAccessInvitation(
                    deps,
                    userId,
                    body.token,
                  ),
                })
              : json({ error: "invalid-request" }, 400);
          case "revoke-invite":
            return typeof body.invitationId === "string"
              ? json({
                  data: await revokeAppAccessInvitation(
                    deps,
                    userId,
                    body.invitationId,
                  ),
                })
              : json({ error: "invalid-request" }, 400);
          default:
            return json({ error: "invalid-action" }, 400);
        }
      },
    },
  },
});
