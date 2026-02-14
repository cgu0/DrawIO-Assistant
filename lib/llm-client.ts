/**
 * LLM 客户端模块 - 处理 Azure OpenAI 和 Claude 的调用
 */

import OpenAI, { AzureOpenAI } from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { config } from "./config";

let cachedAzureClient: AzureOpenAI | null = null;
let cachedClaudeClient: OpenAI | null = null;

function getAzureClient(): AzureOpenAI {
  if (!cachedAzureClient) {
    const { DefaultAzureCredential, getBearerTokenProvider } = require("@azure/identity");
    const credential = new DefaultAzureCredential();
    const scope = "https://cognitiveservices.azure.com/.default";
    const azureADTokenProvider = getBearerTokenProvider(credential, scope);

    cachedAzureClient = new AzureOpenAI({
      endpoint: config.llm.azure.endpoint,
      apiVersion: config.llm.azure.apiVersion,
      azureADTokenProvider,
    });
  }
  return cachedAzureClient;
}

function getClaudeClient(): OpenAI {
  if (!cachedClaudeClient) {
    cachedClaudeClient = new OpenAI({
      apiKey: config.llm.claude.apiKey,
      baseURL: config.llm.claude.baseUrl,
    });
  }
  return cachedClaudeClient;
}

export interface LlmClient {
  client: OpenAI | AzureOpenAI;
  model: string;
  provider: string;
}

/**
 * 根据配置选择 LLM 客户端和模型（按需初始化）
 */
export function getClientAndModel(): LlmClient {
  if (config.llm.provider === "claude") {
    return {
      client: getClaudeClient(),
      model: config.llm.claude.model,
      provider: "claude",
    };
  }
  return {
    client: getAzureClient(),
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
 * 调用 LLM API（非流式）
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
 * 调用 LLM API（流式），返回 stream
 */
export async function callLlmStream(options: LlmCallOptions) {
  const { client, model, provider } = getClientAndModel();
  console.log(`=== Using LLM (stream): ${provider} (${model}) ===`);

  const stream = await client.chat.completions.create({
    model: model,
    messages: options.messages,
    tools: options.tools,
    tool_choice: options.toolChoice || "auto",
    stream: true,
  });

  return stream;
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
