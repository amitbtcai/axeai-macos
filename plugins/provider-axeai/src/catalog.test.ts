import { describe, expect, it, vi } from "vitest";
import {
  buildOpenCodeConfig,
  fetchAxeModelCatalog,
  fetchAxeModels,
} from "./catalog.js";

describe("AxeAI OpenCode catalog", () => {
  it("keeps only tool-capable text models", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "coding-model",
              name: "Coding model",
              modality: "text",
              agentCompatible: true,
              capabilities: { reasoning: true, vision: true, tools: true },
            },
            {
              id: "chat-only",
              name: "Chat only",
              modality: "text",
              agentCompatible: false,
              capabilities: { tools: false },
            },
            {
              id: "image-model",
              name: "Image model",
              modality: "image",
              agentCompatible: false,
              capabilities: { tools: false },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const models = await fetchAxeModels(fetchImpl as typeof fetch);
    expect(models.map((model) => model.id)).toEqual(["coding-model"]);
    const catalog = await fetchAxeModelCatalog(fetchImpl as typeof fetch);
    expect(catalog.map((model) => model.id)).toEqual([
      "coding-model",
      "chat-only",
      "image-model",
    ]);
  });

  it("builds an isolated OpenCode provider configuration", () => {
    const parsed = JSON.parse(
      buildOpenCodeConfig([
        {
          id: "coding-model",
          name: "Coding model",
          modality: "text",
          agentCompatible: true,
          capabilities: { reasoning: true, vision: false, tools: true },
        },
      ]),
    ) as Record<string, unknown>;

    expect(parsed.enabled_providers).toEqual(["axeai"]);
    expect(parsed.model).toBe("axeai/coding-model");
    expect(parsed.provider).toEqual({
      axeai: expect.objectContaining({
        npm: "@ai-sdk/openai-compatible",
        options: { baseURL: "https://axeai.com/v1" },
        models: {
          "coding-model": expect.objectContaining({
            tool_call: true,
            limit: { context: 131_072, output: 4_096 },
          }),
        },
      }),
    });
  });
});
