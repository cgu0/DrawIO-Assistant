import { NextRequest, NextResponse } from "next/server";
import { flowchartTools } from "@/lib/flowchart-tools";
import { buildSystemMessage } from "@/lib/system-prompt";
import { cleanLlmContent } from "@/lib/xml-utils";
import { callLlm, parseToolArguments } from "@/lib/llm-client";
import { handleDisplayDiagram, handleEditDiagram } from "@/lib/mcp-operations";

export async function POST(req: NextRequest) {
  try {
    const { messages, currentXml } = await req.json();

    // 构建系统消息
    const systemMessage = {
      role: "system" as const,
      content: buildSystemMessage(currentXml),
    };

    // 调用 LLM API
    const response = await callLlm({
      messages: [systemMessage, ...messages],
      tools: flowchartTools,
      toolChoice: "required",
    });

    const assistantMessage = response.choices[0].message;

    // 检查是否有 tool calls
    if (assistantMessage.tool_calls?.length) {
      const toolCall = assistantMessage.tool_calls[0];

      console.log("=== Tool Call Raw Data ===");
      console.log("toolCall:", JSON.stringify(toolCall, null, 2));

      // 解析参数
      let args: Record<string, unknown>;
      try {
        args = parseToolArguments(toolCall.function.arguments);
      } catch (parseError) {
        console.error("Failed to parse arguments:", parseError);
        return NextResponse.json(
          {
            type: "error",
            content: `解析工具参数失败: ${(parseError as Error).message}`,
          },
          { status: 500 }
        );
      }

      const cleanContent = cleanLlmContent(assistantMessage.content);

      if (toolCall.function.name === "display_diagram") {
        console.log("=== DISPLAY_DIAGRAM (MCP MODE) ===");
        console.log("XML length:", (args.xml as string)?.length || 0);

        const result = await handleDisplayDiagram(args.xml as string);

        if (!result.success) {
          return NextResponse.json(
            { type: "error", content: result.error },
            { status: 422 }
          );
        }

        return NextResponse.json({
          type: "flowchart",
          content: cleanContent || "已为您生成流程图：",
          xml: result.xml,
        });
      }

      if (toolCall.function.name === "edit_diagram") {
        console.log("=== EDIT_DIAGRAM (MCP MODE) ===");
        console.log("Operations:", JSON.stringify(args.operations, null, 2));

        const result = await handleEditDiagram(
          args.operations as Array<{
            operation: string;
            cell_id?: string;
            new_xml?: string;
          }>,
          currentXml
        );

        if (!result.success) {
          const statusCode = result.error?.includes("没有找到要编辑的图表")
            ? 400
            : 422;
          return NextResponse.json(
            { type: "error", content: result.error },
            { status: statusCode }
          );
        }

        return NextResponse.json({
          type: "flowchart",
          content: cleanContent || "已修改流程图：",
          xml: result.xml,
        });
      }
    }

    // 普通文本回复
    return NextResponse.json({
      type: "text",
      content:
        assistantMessage.content || "我可以帮你绘制流程图，请描述你需要的流程。",
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { type: "error", content: `错误: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
