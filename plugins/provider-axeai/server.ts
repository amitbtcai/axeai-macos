import type {
  BbPluginApi,
  PluginProviderFallbackModel,
} from "@get-bb/plugin-sdk";
import { z } from "zod";
import { generateImage, generateVideo } from "./src/api.js";
import { loginToAxeAI, readAxeToken, removeAxeToken } from "./src/auth.js";
import {
  buildOpenCodeConfig,
  fetchAxeModelCatalog,
  filterAxeCodingModels,
  type AxeModel,
} from "./src/catalog.js";
import { AXEAI_PROVIDER_ID } from "./src/constants.js";

const imageInput = z.object({
  prompt: z.string().trim().min(3),
  model: z.string().trim().min(1).optional(),
});
const videoInput = z.object({
  prompt: z.string().trim().min(3),
  model: z.string().trim().min(1).optional(),
  wait: z.boolean().default(true),
});

function mediaToolParameters(
  models: readonly AxeModel[],
  includeWait: boolean,
): Record<string, unknown> {
  const modelIds = models.map((model) => model.id);
  return {
    type: "object",
    properties: {
      prompt: { type: "string", minLength: 3 },
      model:
        modelIds.length > 0
          ? { type: "string", enum: modelIds }
          : { type: "string", minLength: 1 },
      ...(includeWait ? { wait: { type: "boolean", default: true } } : {}),
    },
    required: ["prompt"],
    additionalProperties: false,
  };
}

export default async function plugin(bb: BbPluginApi): Promise<void> {
  const catalog = await fetchAxeModelCatalog();
  const models = filterAxeCodingModels(catalog);
  const imageModels = catalog.filter((model) => model.modality === "image");
  const videoModels = catalog.filter((model) => model.modality === "video");
  const config = buildOpenCodeConfig(models);
  const reasoningLevels = ["low", "medium", "high", "xhigh", "max"] as const;
  const fallback: PluginProviderFallbackModel[] = models
    .slice(0, 64)
    .map((model, index) => ({
      id: `axeai/${model.id}`,
      displayName: model.name,
      description: model.pricing?.display || "AxeAI model",
      supportedReasoningEfforts:
        model.capabilities?.reasoning === true
          ? reasoningLevels.map((reasoningEffort) => ({
              reasoningEffort,
              description: reasoningEffort,
            }))
          : [{ reasoningEffort: "medium" as const, description: "medium" }],
      defaultReasoningEffort: "medium",
      isDefault: index === 0,
    }));

  bb.providers.register({
    id: AXEAI_PROVIDER_ID,
    displayName: "AxeAI",
    icon: "./icons/axeai.svg",
    experimental_strings: {
      signInHint: "Run `bb axeai login`.",
      expiredHint: "Run `bb axeai login`.",
      installUrl: "https://opencode.ai/docs",
    },
    experimental_models: { fallback },
    experimental_bridgeOptions: {
      acpLaunchSpec: {
        displayName: "AxeAI",
        command: "opencode",
        args: ["--pure", "acp"],
        env: { OPENCODE_CONFIG_CONTENT: config },
      },
    },
    capabilities: {
      experimental_providerHealth: true,
      experimental_providerUsage: false,
      experimental_providerInstallation: false,
      supportsServiceTier: false,
      supportsNativeUserQuestion: false,
      fork: "tip",
      supportsManualCompaction: true,
      supportsThreadArchive: false,
      supportsThreadRename: false,
      permissionModes: ["accept-edits", "full"],
      reasoningLevels,
    },
    composerActions: [],
  });

  bb.agents.registerTool({
    name: "axeai_generate_image",
    description: "Generate an image with an AxeAI image model.",
    parameters: imageInput,
    execute: (input, context) =>
      generateImage({ ...input, signal: context.signal }),
  });
  bb.agents.registerTool({
    name: "axeai_generate_video",
    description: "Generate a video with an AxeAI text-to-video model.",
    parameters: videoInput,
    execute: (input, context) =>
      generateVideo({ ...input, signal: context.signal }),
  });
  bb.agents.configure((context) => ({
    tools:
      context.provider.id === AXEAI_PROVIDER_ID
        ? [
            {
              name: "axeai_generate_image",
              parameters: mediaToolParameters(imageModels, false),
            },
            {
              name: "axeai_generate_video",
              parameters: mediaToolParameters(videoModels, true),
            },
          ]
        : [],
    skills: [],
  }));

  bb.cli.register({
    name: "axeai",
    summary: "AxeAI login and models",
    commands: [
      { name: "login", summary: "AxeAI login", usage: "bb axeai login" },
      { name: "logout", summary: "AxeAI logout", usage: "bb axeai logout" },
      {
        name: "status",
        summary: "AxeAI login status",
        usage: "bb axeai status",
      },
      { name: "models", summary: "AxeAI models", usage: "bb axeai models" },
    ],
    async run(argv, context) {
      switch (argv[0]) {
        case "login":
          await loginToAxeAI(context.signal);
          return { exitCode: 0, stdout: "AxeAI login complete.\n" };
        case "logout":
          await removeAxeToken();
          return { exitCode: 0, stdout: "AxeAI logout complete.\n" };
        case "status":
          return {
            exitCode: 0,
            stdout: (await readAxeToken())
              ? "AxeAI login complete.\n"
              : "AxeAI login required.\n",
          };
        case "models":
          return {
            exitCode: 0,
            stdout: `${catalog.map((model) => model.id).join("\n")}\n`,
          };
        default:
          return {
            exitCode: 1,
            stderr:
              "bb axeai login\nbb axeai logout\nbb axeai status\nbb axeai models\n",
          };
      }
    },
  });
}
