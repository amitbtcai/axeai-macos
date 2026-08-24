import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import plugin from "../server.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AxeAI provider plugin", () => {
  it("registers one provider, scoped media tools, and the AxeAI CLI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: [
                {
                  id: "coding-model",
                  name: "Coding model",
                  modality: "text",
                  agentCompatible: true,
                  capabilities: { reasoning: true, vision: false, tools: true },
                  pricing: { display: "Test" },
                },
                {
                  id: "image-model",
                  name: "Image model",
                  modality: "image",
                },
                {
                  id: "video-model",
                  name: "Video model",
                  modality: "video",
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );
    const host = createFakePluginHost({ pluginId: "provider-axeai" });

    await plugin(host.bb);

    expect(host.harness.registrations.providerRegistrations).toHaveLength(1);
    expect(host.harness.registrations.providerRegistrations[0]).toEqual(
      expect.objectContaining({
        id: "axeai",
        displayName: "AxeAI",
        maintenance: expect.objectContaining({
          health: true,
        }),
        models: expect.objectContaining({ scope: "host" }),
      }),
    );
    expect(
      host.harness.registrations.agentTools.map((tool) => tool.name),
    ).toEqual(["axeai_generate_image", "axeai_generate_video"]);
    expect(host.harness.registrations.cli?.name).toBe("axeai");

    const configure = host.harness.registrations.agentConfigurationProvider!;
    const context = {
      thread: {
        id: "thread",
        title: null,
        parentThreadId: null,
        sourceThreadId: null,
      },
      project: {
        id: "project",
        kind: "standard",
        name: "Project",
        gitRemoteUrl: null,
      },
      environment: {
        id: "environment",
        name: null,
        path: "/tmp/project",
        workspaceProvisionType: "unmanaged",
        branchName: null,
      },
      host: { id: "host", name: "Mac" },
      provider: {
        id: "axeai",
        model: "axeai/coding-model",
        capabilities: { supportsNativeUserQuestion: false },
      },
      origin: { kind: null, pluginId: null },
    } as const;
    expect(configure(context).tools).toEqual([
      expect.objectContaining({
        name: "axeai_generate_image",
        parameters: expect.objectContaining({
          properties: expect.objectContaining({
            model: { type: "string", enum: ["image-model"] },
          }),
        }),
      }),
      expect.objectContaining({
        name: "axeai_generate_video",
        parameters: expect.objectContaining({
          properties: expect.objectContaining({
            model: { type: "string", enum: ["video-model"] },
          }),
        }),
      }),
    ]);
    expect(
      configure({
        ...context,
        provider: { ...context.provider, id: "codex" },
      }).tools,
    ).toEqual([]);
  });
});
