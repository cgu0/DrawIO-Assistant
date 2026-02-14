/**
 * 集中配置管理
 */

export type LlmProvider = "azure" | "claude";

export const config = {
  llm: {
    provider: (process.env.LLM_PROVIDER || "azure") as LlmProvider,
    azure: {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY,
      baseUrl: process.env.CLAUDE_BASE_URL,
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250514",
    },
  },
  mcp: {
    command: "npx",
    args: ["-y", "@next-ai-drawio/mcp-server"],
    clientName: "drawio-chatbot-demo",
    clientVersion: "1.0.0",
  },
  limits: {
    maxXmlSize: 1024 * 1024, // 1MB
    requestTimeout: 30000, // 30 seconds
  },
} as const;
