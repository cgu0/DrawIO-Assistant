"use client";

import { useState, useRef, useCallback } from "react";
import { DrawIOEditor } from "@/components/DrawIOEditor";
import { useScrollToBottom } from "@/hooks/useScrollToBottom";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "text" | "flowchart" | "error";
  xml?: string;
  streaming?: boolean;
}

const createMessageId = () =>
  `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const SUGGESTIONS = [
  {
    title: "用户登录流程",
    desc: "画一个完整的用户登录流程图",
    prompt: "画一个用户登录流程图",
  },
  {
    title: "订单处理流程",
    desc: "画一个电商订单处理流程",
    prompt: "画一个订单处理流程",
  },
  {
    title: "审批流程",
    desc: "画一个包含判断分支的审批流程",
    prompt: "画一个包含判断分支的审批流程",
  },
  {
    title: "系统架构图",
    desc: "画一个微服务系统架构图",
    prompt: "画一个微服务系统架构图",
  },
];

/**
 * 解析 SSE 文本为事件数组
 */
function parseSSEEvents(text: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const blocks = text.split("\n\n");
  for (const block of blocks) {
    if (!block.trim()) continue;
    let event = "";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7);
      else if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (event && data) {
      events.push({ event, data });
    }
  }
  return events;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [currentXml, setCurrentXml] = useState<string>("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { messagesEndRef, scrollContainerRef, isAtBottom, scrollToBottom } =
    useScrollToBottom(messages.length);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  }, []);

  const sendMessage = async (overrideInput?: string) => {
    const text = overrideInput ?? input;
    if (!text.trim() || loading) return;

    const userMessage: Message = {
      id: createMessageId(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setLoading(true);

    const assistantMessageId = createMessageId();

    // 先添加一个空的 assistant 消息，用于流式填充
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        streaming: true,
      },
    ]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          sessionId,
          currentXml,
        }),
        signal: abortController.signal,
      });

      if (!response.body) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 按 \n\n 分割完整的 SSE 事件
        const parts = buffer.split("\n\n");
        // 最后一部分可能不完整，保留到下一轮
        buffer = parts.pop() || "";

        const events = parseSSEEvents(parts.join("\n\n"));

        for (const { event, data } of events) {
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }

          switch (event) {
            case "text":
              // 实时追加文本
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: m.content + (parsed.content as string), type: "text" as const }
                    : m
                )
              );
              break;

            case "status":
              // 显示状态提示
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: parsed.content as string }
                    : m
                )
              );
              break;

            case "flowchart":
              // 图表结果
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        content: parsed.content as string,
                        type: "flowchart" as const,
                        xml: parsed.xml as string,
                        streaming: false,
                      }
                    : m
                )
              );
              if (parsed.xml) {
                setCurrentXml(parsed.xml as string);
              }
              break;

            case "error":
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        content: parsed.content as string,
                        type: "error" as const,
                        streaming: false,
                      }
                    : m
                )
              );
              break;

            case "done":
              // 标记流结束
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, streaming: false }
                    : m
                )
              );
              break;
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        // 用户取消，不处理
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: `请求失败: ${error instanceof Error ? error.message : "未知错误"}`,
                type: "error" as const,
                streaming: false,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const retryLastMessage = () => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) return;

    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.type === "error") {
        return prev.slice(0, -1);
      }
      return prev;
    });

    sendMessage(lastUserMessage.content);
  };

  const copyMessageContent = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const clearConversation = () => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setInput("");
    setCurrentXml("");
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex flex-1 flex-col min-w-0 relative">
        {/* Header bar */}
        {hasMessages && (
          <div className="flex items-center justify-between px-6 py-2.5 border-b border-[#f0f0f0] shrink-0 bg-white">
            <span className="text-sm font-semibold text-[#0d0d0d]">DrawIO Chatbot</span>
            <button
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-[#e5e5e5] rounded-lg bg-white text-[#555] text-[13px] font-[inherit] cursor-pointer transition-colors hover:bg-[#f5f5f5] hover:border-[#d0d0d0] focus-visible:outline-2 focus-visible:outline-[#0d0d0d] focus-visible:outline-offset-2"
              onClick={clearConversation}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
              </svg>
              新对话
            </button>
          </div>
        )}

        <div className="chat-scroll flex-1 overflow-y-auto overflow-x-hidden min-h-0" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(0,0,0,0.15) transparent" }} ref={scrollContainerRef}>
          {/* Welcome / Empty state */}
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center min-h-full px-6 py-10 box-border">
              <div className="w-16 h-16 rounded-2xl bg-[#0d0d0d] text-white flex items-center justify-center mb-5">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" /><path d="m15 5 3 3" />
                </svg>
              </div>
              <h1 className="text-[28px] font-semibold m-0 mb-2 text-[#0d0d0d] tracking-tight">DrawIO Chatbot</h1>
              <p className="text-[15px] text-[#6b6b6b] m-0 mb-10 max-w-[440px] text-center leading-relaxed">AI 驱动的流程图绘制助手，描述你的需求即可生成专业流程图</p>
              <div className="grid grid-cols-2 gap-3 max-w-[600px] w-full max-sm:grid-cols-1">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    className="flex flex-col items-start gap-1 p-4 border border-[#e5e5e5] rounded-[14px] bg-white cursor-pointer text-left font-[inherit] transition-all hover:bg-[#f5f5f5] hover:border-[#d0d0d0] hover:shadow-sm hover:-translate-y-px active:translate-y-0 active:shadow-none focus-visible:outline-2 focus-visible:outline-[#0d0d0d] focus-visible:outline-offset-2 focus-visible:bg-[#f5f5f5] focus-visible:border-[#d0d0d0]"
                    onClick={() => sendMessage(s.prompt)}
                  >
                    <span className="text-sm font-medium text-[#0d0d0d]">{s.title}</span>
                    <span className="text-[13px] text-[#8e8e8e]">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {hasMessages && (
            <div className="py-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`px-6 py-5 animate-msg-enter max-sm:px-4 max-sm:py-4 ${
                    msg.role === "assistant" ? "bg-[#f9f9f9]" : "bg-transparent"
                  }`}
                >
                  <div className="max-w-3xl mx-auto flex gap-4 items-start max-sm:gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 max-sm:w-[30px] max-sm:h-[30px] ${
                        msg.role === "assistant"
                          ? "bg-[#0d0d0d] text-white"
                          : "bg-[#e8e8e8] text-[#555]"
                      }`}
                      aria-hidden="true"
                    >
                      {msg.role === "assistant" ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold text-[#0d0d0d] mb-1.5">
                        {msg.role === "assistant" ? "DrawIO Assistant" : "你"}
                      </span>
                      <div className={`text-[15px] leading-[1.7] text-[#2d2d2d] break-words whitespace-pre-wrap ${msg.type === "error" ? "text-red-600" : ""}`}>
                        {msg.content || (msg.streaming ? "" : "")}
                        {msg.streaming && <span className="animate-blink text-[#0d0d0d] font-light">|</span>}
                      </div>
                      {/* Retry button for error messages */}
                      {msg.type === "error" && !msg.streaming && (
                        <button
                          className="inline-flex items-center gap-1.5 mt-2 px-3.5 py-1.5 border border-[#e5e5e5] rounded-lg bg-white text-[#555] text-[13px] font-[inherit] cursor-pointer transition-colors hover:bg-[#f5f5f5] hover:border-[#d0d0d0] focus-visible:outline-2 focus-visible:outline-[#0d0d0d] focus-visible:outline-offset-2"
                          onClick={retryLastMessage}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                          </svg>
                          重试
                        </button>
                      )}
                      {/* Copy button for assistant messages */}
                      {msg.role === "assistant" && msg.content && !msg.streaming && msg.type !== "error" && (
                        <div className="mt-2 opacity-0 transition-opacity group-hover/msg:opacity-100">
                          <button
                            className="inline-flex items-center gap-1 px-2.5 py-1 border-none rounded-md bg-transparent text-[#8e8e8e] text-xs font-[inherit] cursor-pointer transition-colors hover:text-[#555] hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-[#0d0d0d] focus-visible:outline-offset-2"
                            onClick={() => copyMessageContent(msg.id, msg.content)}
                            aria-label="复制内容"
                          >
                            {copiedMessageId === msg.id ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                                已复制
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                </svg>
                                复制
                              </>
                            )}
                          </button>
                        </div>
                      )}
                      {msg.type === "flowchart" && msg.xml && (
                        <div className="mt-3">
                          <DrawIOEditor
                            xml={msg.xml}
                            onXmlChange={(newXml) => {
                              setCurrentXml(newXml);
                              setMessages((prev) =>
                                prev.map((m) =>
                                  m.id === msg.id ? { ...m, xml: newXml } : m
                                )
                              );
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Scroll to bottom FAB */}
        {hasMessages && !isAtBottom && (
          <button
            className="absolute bottom-[100px] left-1/2 -translate-x-1/2 w-9 h-9 rounded-full border border-[#e5e5e5] bg-white text-[#555] cursor-pointer flex items-center justify-center shadow-md transition-all hover:bg-[#f5f5f5] hover:shadow-lg z-10 focus-visible:outline-2 focus-visible:outline-[#0d0d0d] focus-visible:outline-offset-2 max-sm:bottom-20"
            onClick={scrollToBottom}
            aria-label="滚动到底部"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m7 13 5 5 5-5" /><path d="M12 18V6" />
            </svg>
          </button>
        )}

        {/* Input area */}
        <div className="flex flex-col items-center px-6 pt-3 pb-[calc(20px+env(safe-area-inset-bottom,0px))] max-sm:px-3 max-sm:pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
          <div className={`max-w-3xl w-full flex items-end bg-white border border-[#d9d9d9] rounded-2xl py-2 pr-3 pl-4 shadow-sm transition-all focus-within:border-[#a0a0a0] focus-within:shadow-md ${loading ? "animate-pulse-border" : ""}`}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder="描述你需要的流程图，或要求修改现有图表..."
              disabled={loading}
              rows={1}
              className="flex-1 border-none outline-none text-[15px] font-[inherit] leading-normal resize-none max-h-[200px] py-1.5 bg-transparent text-[#0d0d0d] transition-opacity placeholder:text-[#a0a0a0] disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              className="w-9 h-9 border-none rounded-[10px] bg-[#0d0d0d] text-white cursor-pointer flex items-center justify-center shrink-0 transition-all hover:bg-[#2d2d2d] disabled:bg-[#e0e0e0] disabled:text-[#a0a0a0] disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[#0d0d0d] focus-visible:outline-offset-2"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              aria-label="发送消息"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-[#a0a0a0] mt-2 m-0">按 Enter 发送，Shift + Enter 换行</p>
        </div>
      </div>
    </div>
  );
}
