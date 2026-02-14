import { NextRequest } from "next/server";
import { flowchartTools } from "@/lib/flowchart-tools";
import { buildSystemMessage } from "@/lib/system-prompt";
import { callLlmStream, parseToolArguments } from "@/lib/llm-client";
import { handleDisplayDiagram, handleEditDiagram } from "@/lib/mcp-operations";
import { config } from "@/lib/config";

// 允许的 message role
const VALID_ROLES = new Set(["user", "assistant"]);

// 单条消息最大长度
const MAX_MESSAGE_LENGTH = 10000;

// 最大历史消息数
const MAX_MESSAGES = 50;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * 校验请求体，返回错误信息或 null
 */
function validateRequest(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return "请求体格式错误";
  }

  const { messages, currentXml } = body as Record<string, unknown>;

  if (!Array.isArray(messages)) {
    return "messages 必须是数组";
  }

  if (messages.length === 0) {
    return "messages 不能为空";
  }

  if (messages.length > MAX_MESSAGES) {
    return `消息数量超过限制（最多 ${MAX_MESSAGES} 条）`;
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") {
      return `messages[${i}] 格式错误`;
    }

    const { role, content } = msg as ChatMessage;

    if (typeof role !== "string" || !VALID_ROLES.has(role)) {
      return `messages[${i}].role 无效，必须是 user 或 assistant`;
    }

    if (typeof content !== "string") {
      return `messages[${i}].content 必须是字符串`;
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      return `messages[${i}].content 超过长度限制（最多 ${MAX_MESSAGE_LENGTH} 字符）`;
    }
  }

  if (currentXml !== undefined && currentXml !== null && currentXml !== "") {
    if (typeof currentXml !== "string") {
      return "currentXml 必须是字符串";
    }

    if (currentXml.length > config.limits.maxXmlSize) {
      return `currentXml 超过大小限制（最大 ${Math.round(config.limits.maxXmlSize / 1024)}KB）`;
    }
  }

  return null;
}

/**
 * 格式化 SSE 事件
 */
function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  // 解析请求体
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      sseEvent("error", { content: "请求体 JSON 解析失败" }),
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  // 输入校验
  const validationError = validateRequest(body);
  if (validationError) {
    return new Response(
      sseEvent("error", { content: validationError }),
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const { messages, currentXml } = body as {
    messages: ChatMessage[];
    currentXml?: string;
  };

  const systemMessage = {
    role: "system" as const,
    content: buildSystemMessage(currentXml),
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      try {
        const llmStream = await callLlmStream({
          messages: [systemMessage, ...messages],
          tools: flowchartTools,
          toolChoice: "required",
        });

        // 从流中累积内容和 tool call
        let textContent = "";
        let toolCallName = "";
        let toolCallArgs = "";
        let hasToolCall = false;

        for await (const chunk of llmStream) {
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          // 文本内容流式输出
          if (delta.content) {
            textContent += delta.content;
            send("text", { content: delta.content });
          }

          // tool call 累积（不能流式输出，需要完整参数才能执行）
          if (delta.tool_calls?.length) {
            hasToolCall = true;
            const tc = delta.tool_calls[0];
            if (tc.function?.name) {
              toolCallName = tc.function.name;
              // 收到 tool call name 后通知前端
              send("status", { content: "正在生成流程图..." });
            }
            if (tc.function?.arguments) {
              toolCallArgs += tc.function.arguments;
            }
          }
        }

        // 流结束，处理结果
        if (hasToolCall && toolCallName) {
          let args: Record<string, unknown>;
          try {
            args = parseToolArguments(toolCallArgs);
          } catch {
            send("error", { content: "AI 返回的工具参数格式异常，请重试" });
            send("done", {});
            controller.close();
            return;
          }

          if (toolCallName === "display_diagram") {
            const result = await handleDisplayDiagram(args.xml as string);

            if (!result.success) {
              send("error", { content: result.error || "创建图表失败" });
            } else {
              send("flowchart", {
                content: textContent || "已为您生成流程图：",
                xml: result.xml,
              });
            }
          } else if (toolCallName === "edit_diagram") {
            const result = await handleEditDiagram(
              args.operations as Array<{
                operation: string;
                cell_id?: string;
                new_xml?: string;
              }>,
              currentXml ?? null
            );

            if (!result.success) {
              send("error", { content: result.error || "编辑图表失败" });
            } else {
              send("flowchart", {
                content: textContent || "已修改流程图：",
                xml: result.xml,
              });
            }
          }
        } else if (textContent) {
          // 纯文本响应已经流式发出，不需要额外操作
        } else {
          send("text", { content: "我可以帮你绘制流程图，请描述你需要的流程。" });
        }

        send("done", {});
        controller.close();
      } catch (error) {
        console.error("Chat API stream error:", error);
        send("error", { content: "服务处理请求时发生错误，请稍后重试" });
        send("done", {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
