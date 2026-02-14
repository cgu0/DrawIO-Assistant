# DrawIO Assistant

An AI-powered chatbot that converts natural language descriptions into interactive draw.io flowcharts. Users describe diagrams in plain language, and the LLM generates and renders professional flowcharts in real time.

## Features

- **Natural Language to Diagram** - Describe a flowchart in plain language (e.g., "Draw a user login flow") and get a fully rendered draw.io diagram
- **Interactive Editing** - Ask the AI to modify colors, shapes, structure, or add new elements to existing diagrams
- **Live draw.io Editor** - Diagrams render in an embedded interactive draw.io canvas with full editing support
- **Multi-LLM Support** - Works with both Azure OpenAI (GPT-4o) and Claude models
- **MCP Protocol Integration** - Uses the Model Context Protocol for standardized diagram operations via `@next-ai-drawio/mcp-server`
- **Streaming Chat UI** - ChatGPT-style interface with typing animation and auto-scroll

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript |
| Backend | Next.js API Routes |
| LLM | OpenAI SDK (Azure OpenAI / Claude) |
| Diagram | react-drawio (embedded draw.io) |
| MCP | @modelcontextprotocol/sdk |
| Security | DOMPurify (XSS protection) |

## Getting Started

### Prerequisites

- Node.js 20+
- An Azure OpenAI or Claude API key
- (Azure) `az login` for Azure credential authentication

### Installation

```bash
# Clone the repository
git clone https://github.com/cgu0/DrawIO-Assistant.git
cd DrawIO-Assistant

# Install dependencies
npm install
```

### Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your configuration:

**Option 1: Azure OpenAI**

```env
LLM_PROVIDER=azure
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

**Option 2: Claude**

```env
LLM_PROVIDER=claude
CLAUDE_API_KEY=sk-your-api-key
CLAUDE_BASE_URL=https://api.anthropic.com/v1
CLAUDE_MODEL=claude-sonnet-4-5-20250929
```

### Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

The app runs on [http://localhost:3001](http://localhost:3001).

## How It Works

```
User Input (Chat)
      |
      v
  API /chat (POST)
      |
      v
  LLM Call with Tool Definitions (Azure OpenAI / Claude)
      |
      v
  Tool Call: display_diagram or edit_diagram
      |
      v
  MCP Server (@next-ai-drawio/mcp-server)
      |
      v
  XML Validation & Rendering
      |
      v
  draw.io Editor Displays Diagram
```

1. The user sends a message describing a diagram
2. The backend builds a system prompt with the current diagram context (if any) and calls the LLM
3. The LLM responds with a tool call (`display_diagram` for new diagrams, `edit_diagram` for modifications)
4. The MCP server processes the tool call and generates valid draw.io XML
5. The frontend renders the XML in an embedded draw.io editor

## Project Structure

```
demo-chatbot/
├── app/
│   ├── api/chat/route.ts      # Chat API endpoint
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Main chat interface
├── components/
│   └── DrawIOEditor.tsx        # draw.io editor wrapper
├── hooks/
│   ├── useScrollToBottom.ts    # Auto-scroll behavior
│   └── useStreamingMessage.ts  # Typing animation effect
├── lib/
│   ├── config.ts               # Configuration management
│   ├── llm-client.ts           # LLM abstraction layer
│   ├── flowchart-tools.ts      # LLM tool definitions
│   ├── system-prompt.ts        # LLM system instructions
│   ├── mcp-operations.ts       # MCP operation handlers
│   ├── mcp-client.ts           # MCP connection manager
│   ├── xml-utils.ts            # XML utilities
│   └── sanitize-drawio-edges.ts # Edge sanitization
├── .env.local.example          # Environment template
├── package.json
└── tsconfig.json
```

## License

MIT
