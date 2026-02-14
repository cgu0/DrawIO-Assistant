import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { config } from "./config";

class McpClientManager {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;
  private sessionStarted = false;

  async connect(): Promise<Client> {
    if (this.client && this.connected) {
      return this.client;
    }

    this.transport = new StdioClientTransport({
      command: config.mcp.command,
      args: [...config.mcp.args],
      env: process.env as Record<string, string>,
    });

    this.client = new Client({
      name: config.mcp.clientName,
      version: config.mcp.clientVersion,
    });

    await this.client.connect(this.transport);
    this.connected = true;
    this.sessionStarted = false; // 重置会话状态

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
