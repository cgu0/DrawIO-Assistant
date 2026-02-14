<div align="center">

# DrawIO Assistant

**Turn natural language into professional flowcharts — powered by AI and draw.io**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-blueviolet?style=flat-square)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

---

*Describe what you want. Watch the diagram appear. Edit with words, not clicks.*

</div>

## What is DrawIO Assistant?

DrawIO Assistant is a chatbot that bridges the gap between **what you imagine** and **what you draw**. Instead of manually dragging shapes and connecting lines, simply tell the AI what you need:

> "Draw a user login flow with email verification and error handling"

The AI generates a complete, editable draw.io diagram in seconds — and you can keep refining it through conversation.

## Key Features

| | Feature | Description |
|---|---------|-------------|
| **Chat** | Natural Language Input | Describe diagrams in plain language and get fully rendered flowcharts |
| **Edit** | Conversational Editing | Ask the AI to change colors, restructure flows, or add new elements |
| **Canvas** | Live draw.io Editor | Interactive embedded canvas with full manual editing support |
| **AI** | Multi-LLM Support | Switch between Azure OpenAI (GPT-4o) and Claude |
| **Protocol** | MCP Integration | Standardized diagram operations via `@next-ai-drawio/mcp-server` |
| **UX** | Streaming Chat UI | ChatGPT-style interface with typing animation |

## Tech Stack

```
Frontend    Next.js 14 / React 18 / TypeScript
Styling     Tailwind CSS 3
Backend     Next.js API Routes
LLM         OpenAI SDK (Azure OpenAI + Claude)
Diagram     react-drawio (embedded draw.io)
Protocol    @modelcontextprotocol/sdk
Security    DOMPurify (XSS protection)
```

## Quick Start

### Prerequisites

- **Node.js** 20+
- **API Key** for Azure OpenAI or Claude
- (Azure only) Run `az login` for credential authentication

### 1. Clone & Install

```bash
git clone https://github.com/cgu0/DrawIO-Assistant.git
cd DrawIO-Assistant
npm install
```

### 2. Configure

```bash
cp .env.local.example .env.local
```

<details>
<summary><b>Option A: Azure OpenAI</b></summary>

```env
LLM_PROVIDER=azure
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```
</details>

<details>
<summary><b>Option B: Claude</b></summary>

```env
LLM_PROVIDER=claude
CLAUDE_API_KEY=sk-your-api-key
CLAUDE_BASE_URL=https://api.anthropic.com/v1
CLAUDE_MODEL=claude-sonnet-4-5-20250514
```
</details>

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) and start chatting.

## How It Works

```
  You: "Draw a microservices architecture"
   |
   v
  +---------------------+
  | Chat API (/api/chat)|
  +---------------------+
   |
   v
  +---------------------+
  | LLM (GPT-4o/Claude) |  <-- Tool definitions: display_diagram / edit_diagram
  +---------------------+
   |
   v
  +---------------------+
  | MCP Server          |  <-- @next-ai-drawio/mcp-server
  +---------------------+
   |
   v
  +---------------------+
  | draw.io Editor      |  <-- Interactive, editable diagram
  +---------------------+
```

1. You describe a diagram in the chat
2. The backend sends your message + current diagram context to the LLM
3. The LLM calls `display_diagram` (new) or `edit_diagram` (modify existing)
4. The MCP server generates valid draw.io XML
5. The embedded draw.io editor renders the result

## Project Structure

```text
app/
  api/chat/route.ts        Chat API endpoint
  layout.tsx               Root layout
  page.tsx                 Main chat interface

components/
  DrawIOEditor.tsx         draw.io editor wrapper

hooks/
  useScrollToBottom.ts     Smart auto-scroll behavior

lib/
  config.ts                Configuration management
  llm-client.ts            LLM abstraction layer
  flowchart-tools.ts       LLM tool definitions
  system-prompt.ts         LLM system instructions
  mcp-operations.ts        MCP operation handlers
  mcp-client.ts            MCP connection manager
  xml-utils.ts             XML utilities
  sanitize-drawio-edges.ts Edge sanitization
```

## License

MIT

---

<div align="center">

Built with [Next.js](https://nextjs.org/) and [draw.io](https://www.drawio.com/)

</div>
