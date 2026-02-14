/**
 * LLM 客户端模块 - 处理 Azure OpenAI 和 Claude 的调用
 */

import OpenAI, { AzureOpenAI } from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { config } from "./config";

// Azure OpenAI 配置
const credential = new DefaultAzureCredential();
const scope = "https://cognitiveservices.azure.com/.default";
const azureADTokenProvider = getBearerTokenProvider(credential, scope);

const azureClient = new AzureOpenAI({
  endpoint: config.llm.azure.endpoint,
  apiVersion: config.llm.azure.apiVersion,
  azureADTokenProvider,
});

// Claude 配置 (通过 OpenAI 兼容代理)
const claudeClient = new OpenAI({
  apiKey: config.llm.claude.apiKey,
  baseURL: config.llm.claude.baseUrl,
});

export interface LlmClient {
  client: OpenAI | AzureOpenAI;
  model: string;
  provider: string;
}

/**
 * 根据配置选择 LLM 客户端和模型
 */
export function getClientAndModel(): LlmClient {
  if (config.llm.provider === "claude") {
    return {
      client: claudeClient,
      model: config.llm.claude.model,
      provider: "claude",
    };
  }
  return {
    client: azureClient,
    model: config.llm.azure.deployment,
    provider: "azure",
  };
}

export interface LlmCallOptions {
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  toolChoice?: "auto" | "required" | "none";
}

/**
 * 调用 LLM API
 */
export async function callLlm(options: LlmCallOptions) {
  const { client, model, provider } = getClientAndModel();
  console.log(`=== Using LLM: ${provider} (${model}) ===`);

  const response = await client.chat.completions.create({
    model: model,
    messages: options.messages,
    tools: options.tools,
    tool_choice: options.toolChoice || "auto",
  });

  return response;
}

/**
 * 解析工具调用参数
 */
export function parseToolArguments(
  args: string | object
): Record<string, unknown> {
  if (typeof args === "string") {
    return JSON.parse(args);
  }
  return args as Record<string, unknown>;
}
