import { z } from "zod";
import {
  AXEAI_OPENCODE_PROVIDER_ID,
  AXEAI_ORIGIN,
  FALLBACK_MODELS,
} from "./constants.js";

const axeModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  modality: z.enum(["text", "image", "video"]),
  agentCompatible: z.boolean().optional(),
  capabilities: z
    .object({
      reasoning: z.boolean().optional(),
      vision: z.boolean().optional(),
      tools: z.boolean().optional(),
    })
    .optional(),
  pricing: z.object({ display: z.string().optional() }).optional(),
});

const catalogSchema = z.object({ data: z.array(axeModelSchema) });

export type AxeModel = z.infer<typeof axeModelSchema>;

export async function fetchAxeModelCatalog(
  fetchImpl: typeof fetch = fetch,
): Promise<AxeModel[]> {
  try {
    const response = await fetchImpl(`${AXEAI_ORIGIN}/v1/models`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [...FALLBACK_MODELS].map(fallbackModel);
    const parsed = catalogSchema.safeParse(await response.json());
    if (!parsed.success) return [...FALLBACK_MODELS].map(fallbackModel);
    return parsed.data.data;
  } catch {
    return [...FALLBACK_MODELS].map(fallbackModel);
  }
}

export function filterAxeCodingModels(models: readonly AxeModel[]): AxeModel[] {
  const codingModels = models.filter(
    (model) =>
      model.modality === "text" &&
      (model.agentCompatible ?? model.capabilities?.tools ?? false),
  );
  return codingModels.length > 0
    ? codingModels
    : [...FALLBACK_MODELS].map(fallbackModel);
}

export async function fetchAxeModels(
  fetchImpl: typeof fetch = fetch,
): Promise<AxeModel[]> {
  return filterAxeCodingModels(await fetchAxeModelCatalog(fetchImpl));
}

function fallbackModel(model: (typeof FALLBACK_MODELS)[number]): AxeModel {
  return {
    ...model,
    modality: "text",
    agentCompatible: true,
    capabilities: { reasoning: model.reasoning, vision: false, tools: true },
  };
}

export function buildOpenCodeConfig(models: readonly AxeModel[]): string {
  const configuredModels = Object.fromEntries(
    models.map((model) => [
      model.id,
      {
        name: model.name,
        reasoning: model.capabilities?.reasoning === true,
        attachment: model.capabilities?.vision === true,
        tool_call: true,
        limit: { context: 131_072, output: 4_096 },
      },
    ]),
  );
  const defaultModel = models[0]?.id ?? FALLBACK_MODELS[0].id;
  return JSON.stringify({
    $schema: "https://opencode.ai/config.json",
    provider: {
      [AXEAI_OPENCODE_PROVIDER_ID]: {
        npm: "@ai-sdk/openai-compatible",
        name: "AxeAI",
        options: { baseURL: `${AXEAI_ORIGIN}/v1` },
        models: configuredModels,
      },
    },
    enabled_providers: [AXEAI_OPENCODE_PROVIDER_ID],
    model: `${AXEAI_OPENCODE_PROVIDER_ID}/${defaultModel}`,
  });
}
