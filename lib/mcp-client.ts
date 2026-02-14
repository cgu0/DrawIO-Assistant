import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { config } from "./config";

/**
 * MCP 需要传递给子进程的环境变量白名单
 * 只传递必要的变量，避免泄露敏感信息
 */
const MCP_ENV_ALLOWLIST = [
  "PATH",
  "NODE_ENV",
  "HOME",
  "USER",
  "LANG",
  "TERM",
  "SHELL",
  // npm/node 相关
  "NODE_PATH",
  "NPM_CONFIG_REGISTRY",
  "npm_config_registry",
];

function buildMcpEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of MCP_ENV_ALLOWLIST) {
    if (process.env[key]) {
      env[key] = process.env[key]!;
    }
  }
  return env;
}

class McpClientManager {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;
  private sessionStarted = false;

  // 用 Promise 作为并发锁，防止重复创建连接/会话
  private connectingPromise: Promise<Client> | null = null;
  private sessionPromise: Promise<void> | null = null;

  async connect(): Promise<Client> {
    // 已连接，直接返回
    if (this.client && this.connected) {
      return this.client;
    }

    // 正在连接中，等待同一个 Promise
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    // 发起新连接，缓存 Promise 防止并发重入
    this.connectingPromise = this.doConnect();

    try {
      return await this.connectingPromise;
    } finally {
      this.connectingPromise = null;
    }
  }

  private async doConnect(): Promise<Client> {
    // 如果有残留的旧连接，先清理
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // 忽略关闭错误
      }
      this.client = null;
      this.transport = null;
    }

    this.transport = new StdioClientTransport({
      command: config.mcp.command,
      args: [...config.mcp.args],
      env: buildMcpEnv(),
    });

    this.client = new Client({
      name: config.mcp.clientName,
      version: config.mcp.clientVersion,
    });

    await this.client.connect(this.transport);
    this.connected = true;
    this.sessionStarted = false;

    this.transport.onclose = () => {
      this.connected = false;
      this.sessionStarted = false;
      this.client = null;
    };

    return this.client;
  }

  /**
   * 确保 MCP 会话已启动
   * @next-ai-drawio/mcp-server 需要先调用 start_session
   */
  async ensureSession(): Promise<void> {
    if (this.sessionStarted) {
      return;
    }

    // 正在建会话，等待同一个 Promise
    if (this.sessionPromise) {
      return this.sessionPromise;
    }

    this.sessionPromise = this.doEnsureSession();

    try {
      await this.sessionPromise;
    } finally {
      this.sessionPromise = null;
    }
  }

  private async doEnsureSession(): Promise<void> {
    const client = await this.connect();

    try {
      console.log("Starting MCP session...");
      const result = await client.callTool({ name: "start_session", arguments: {} });
      console.log("MCP session started:", result);
      this.sessionStarted = true;
    } catch (error) {
      console.error("Failed to start MCP session:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.connected = false;
      this.sessionStarted = false;
      this.client = null;
      this.transport = null;
    }
  }

  async callTool(name: string, args: Record<string, unknown>) {
    const client = await this.connect();
    return await client.callTool({ name, arguments: args });
  }

  async listTools() {
    const client = await this.connect();
    return await client.listTools();
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const mcpClient = new McpClientManager();
