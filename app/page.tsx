"use client";

import { useState, useRef, useCallback } from "react";
import { DrawIOEditor } from "@/components/DrawIOEditor";
import { useStreamingMessage } from "@/hooks/useStreamingMessage";
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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [currentXml, setCurrentXml] = useState<string>("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { startStreaming, stopAllStreaming } = useStreamingMessage({ setMessages });
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
      });

      const data = await response.json();

      const assistantMessageId = createMessageId();
      const displayContent = data.content || "收到响应";
      const shouldStream = data.type !== "error" && Boolean(displayContent);

      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: shouldStream ? "" : displayContent,
        type: data.type,
        xml: data.xml,
        streaming: shouldStream,
      };

      if (data.xml) {
        setCurrentXml(data.xml);
      }

      setMessages((prev) => [...prev, assistantMessage]);
      if (shouldStream) {
        startStreaming(assistantMessageId, displayContent);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          content: `请求失败: ${error instanceof Error ? error.message : "未知错误"}`,
          type: "error",
        },
      ]);
    } finally {
      setLoading(false);
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
    stopAllStreaming();
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
    <div className="page">
      <div className="main">
        {/* Header bar - visible when there are messages */}
        {hasMessages && (
          <div className="chat-header">
            <span className="chat-header-title">DrawIO Chatbot</span>
            <button className="new-chat-btn" onClick={clearConversation}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
              </svg>
              新对话
            </button>
          </div>
        )}

        <div className="chat-scroll" ref={scrollContainerRef}>
          {!hasMessages && (
            <div className="welcome">
              <div className="welcome-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" /><path d="m15 5 3 3" />
                </svg>
              </div>
              <h1 className="welcome-title">DrawIO Chatbot</h1>
              <p className="welcome-subtitle">AI 驱动的流程图绘制助手，描述你的需求即可生成专业流程图</p>
              <div className="suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    className="suggestion-card"
                    onClick={() => sendMessage(s.prompt)}
                  >
                    <span className="suggestion-title">{s.title}</span>
                    <span className="suggestion-desc">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasMessages && (
            <div className="messages">
              {messages.map((msg) => (
                <div key={msg.id} className={`msg-row ${msg.role}`}>
                  <div className="msg-row-inner">
                    <div className="avatar" aria-hidden="true">
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
                    <div className="msg-body">
                      <span className="msg-sender">
                        {msg.role === "assistant" ? "DrawIO Assistant" : "你"}
                      </span>
                      <div className={`msg-content ${msg.type === "error" ? "error" : ""}`}>
                        {msg.content || (msg.streaming ? "" : "")}
                        {msg.streaming && <span className="cursor">|</span>}
                      </div>
                      {/* Retry button for error messages */}
                      {msg.type === "error" && (
                        <button className="retry-btn" onClick={retryLastMessage}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                          </svg>
                          重试
                        </button>
                      )}
                      {/* Copy button for assistant messages */}
                      {msg.role === "assistant" && msg.content && !msg.streaming && msg.type !== "error" && (
                        <div className="msg-actions">
                          <button
                            className="action-btn"
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
                        <div className="editor-embed">
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

              {loading && (
                <div className="msg-row assistant">
                  <div className="msg-row-inner">
                    <div className="avatar" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
                      </svg>
                    </div>
                    <div className="msg-body">
                      <span className="msg-sender">DrawIO Assistant</span>
                      <div className="msg-content loading-dots" role="status" aria-label="生成中">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Scroll to bottom FAB */}
        {hasMessages && !isAtBottom && (
          <button
            className="scroll-to-bottom-btn"
            onClick={scrollToBottom}
            aria-label="滚动到底部"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m7 13 5 5 5-5" /><path d="M12 18V6" />
            </svg>
          </button>
        )}

        {/* Input area */}
        <div className="input-wrapper">
          <div className={`input-box ${loading ? "loading" : ""}`}>
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
            />
            <button
              className="send-btn"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              aria-label="发送消息"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>
          <p className="input-hint">按 Enter 发送，Shift + Enter 换行</p>
        </div>
      </div>

      <style jsx>{`
        .page {
          height: 100vh;
          display: flex;
          overflow: hidden;
        }

        /* Main chat area */
        .main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          position: relative;
        }

        /* Header bar */
        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 24px;
          border-bottom: 1px solid #f0f0f0;
          flex-shrink: 0;
          background: #fff;
        }

        .chat-header-title {
          font-size: 14px;
          font-weight: 600;
          color: #0d0d0d;
        }

        .new-chat-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          background: #fff;
          color: #555;
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }

        .new-chat-btn:hover {
          background: #f5f5f5;
          border-color: #d0d0d0;
        }

        .chat-scroll {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          min-height: 0;
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
        }

        .chat-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .chat-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .chat-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 3px;
        }

        .chat-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.25);
        }

        /* Welcome / Empty state */
        .welcome {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100%;
          padding: 40px 24px;
          box-sizing: border-box;
        }

        .welcome-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: #0d0d0d;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }

        .welcome-title {
          font-size: 28px;
          font-weight: 600;
          margin: 0 0 8px;
          color: #0d0d0d;
          letter-spacing: -0.02em;
        }

        .welcome-subtitle {
          font-size: 15px;
          color: #6b6b6b;
          margin: 0 0 40px;
          max-width: 440px;
          text-align: center;
          line-height: 1.5;
        }

        .suggestions {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          max-width: 600px;
          width: 100%;
        }

        .suggestion-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 16px;
          border: 1px solid #e5e5e5;
          border-radius: 14px;
          background: #fff;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: background-color 0.15s ease, border-color 0.15s ease,
                      box-shadow 0.2s ease, transform 0.2s ease;
        }

        .suggestion-card:hover {
          background: #f5f5f5;
          border-color: #d0d0d0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          transform: translateY(-1px);
        }

        .suggestion-card:active {
          transform: translateY(0);
          box-shadow: none;
        }

        .suggestion-card:focus-visible {
          outline: 2px solid #0d0d0d;
          outline-offset: 2px;
          background: #f5f5f5;
          border-color: #d0d0d0;
        }

        .suggestion-title {
          font-size: 14px;
          font-weight: 500;
          color: #0d0d0d;
        }

        .suggestion-desc {
          font-size: 13px;
          color: #8e8e8e;
        }

        /* Messages */
        .messages {
          padding: 16px 0;
        }

        @keyframes message-enter {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .msg-row {
          padding: 20px 24px;
          animation: message-enter 0.2s ease-out;
        }

        .msg-row.user {
          background: transparent;
        }

        .msg-row.assistant {
          background: #f9f9f9;
        }

        .msg-row-inner {
          max-width: 768px;
          margin: 0 auto;
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .msg-row.user .avatar {
          background: #e8e8e8;
          color: #555;
        }

        .msg-row.assistant .avatar {
          background: #0d0d0d;
          color: #fff;
        }

        .msg-body {
          flex: 1;
          min-width: 0;
        }

        .msg-sender {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #0d0d0d;
          margin-bottom: 6px;
        }

        .msg-content {
          font-size: 15px;
          line-height: 1.7;
          color: #2d2d2d;
          word-break: break-word;
          white-space: pre-wrap;
        }

        .msg-content.error {
          color: #dc2626;
        }

        .cursor {
          animation: blink 1s step-end infinite;
          color: #0d0d0d;
          font-weight: 300;
        }

        @keyframes blink {
          50% { opacity: 0; }
        }

        /* Message actions (copy button) */
        .msg-actions {
          margin-top: 8px;
          opacity: 0;
          transition: opacity 0.15s ease;
        }

        .msg-row:hover .msg-actions {
          opacity: 1;
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: #8e8e8e;
          font-size: 12px;
          font-family: inherit;
          cursor: pointer;
          transition: color 0.15s ease, background-color 0.15s ease;
        }

        .action-btn:hover {
          color: #555;
          background: rgba(0, 0, 0, 0.05);
        }

        /* Retry button */
        .retry-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          padding: 6px 14px;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          background: #fff;
          color: #555;
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }

        .retry-btn:hover {
          background: #f5f5f5;
          border-color: #d0d0d0;
        }

        /* Loading dots */
        .loading-dots {
          display: flex;
          gap: 4px;
          padding: 4px 0;
        }

        .loading-dots span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #b0b0b0;
          animation: dot-bounce 1.4s ease-in-out infinite;
        }

        .loading-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .loading-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes dot-bounce {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }

        /* DrawIO editor embed */
        .editor-embed {
          margin-top: 12px;
        }

        /* Scroll to bottom button */
        .scroll-to-bottom-btn {
          position: absolute;
          bottom: 100px;
          left: 50%;
          transform: translateX(-50%);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid #e5e5e5;
          background: #fff;
          color: #555;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transition: background-color 0.15s ease, box-shadow 0.15s ease;
          z-index: 10;
        }

        .scroll-to-bottom-btn:hover {
          background: #f5f5f5;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        /* Input area */
        .input-wrapper {
          padding: 12px 24px calc(20px + env(safe-area-inset-bottom, 0px));
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .input-box {
          max-width: 768px;
          width: 100%;
          display: flex;
          align-items: flex-end;
          gap: 0;
          background: #fff;
          border: 1px solid #d9d9d9;
          border-radius: 16px;
          padding: 8px 12px 8px 16px;
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.05);
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .input-box:focus-within {
          border-color: #a0a0a0;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
        }

        .input-box.loading {
          animation: pulse-border 2s ease-in-out infinite;
        }

        @keyframes pulse-border {
          0%, 100% { border-color: #d9d9d9; }
          50% { border-color: #a0a0a0; }
        }

        .input-box textarea {
          flex: 1;
          border: none;
          outline: none;
          font-size: 15px;
          font-family: inherit;
          line-height: 1.5;
          resize: none;
          max-height: 200px;
          padding: 6px 0;
          background: transparent;
          color: #0d0d0d;
          transition: opacity 0.15s ease;
        }

        .input-box textarea:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .input-box textarea::placeholder {
          color: #a0a0a0;
        }

        .send-btn {
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 10px;
          background: #0d0d0d;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background-color 0.15s ease, opacity 0.15s ease;
        }

        .send-btn:hover:not(:disabled) {
          background: #2d2d2d;
        }

        .send-btn:disabled {
          background: #e0e0e0;
          color: #a0a0a0;
          cursor: not-allowed;
        }

        .input-hint {
          font-size: 12px;
          color: #a0a0a0;
          margin: 8px 0 0;
        }

        /* Focus visible states */
        .send-btn:focus-visible,
        .new-chat-btn:focus-visible,
        .retry-btn:focus-visible,
        .action-btn:focus-visible,
        .scroll-to-bottom-btn:focus-visible {
          outline: 2px solid #0d0d0d;
          outline-offset: 2px;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .suggestions {
            grid-template-columns: 1fr;
          }

          .msg-row {
            padding: 16px;
          }

          .msg-row-inner {
            gap: 12px;
          }

          .avatar {
            width: 30px;
            height: 30px;
          }

          .avatar :global(svg) {
            width: 16px;
            height: 16px;
          }

          .welcome-title {
            font-size: 22px;
          }

          .input-wrapper {
            padding: 8px 12px calc(16px + env(safe-area-inset-bottom, 0px));
          }

          .chat-header {
            padding: 10px 16px;
          }

          .scroll-to-bottom-btn {
            bottom: 80px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cursor,
          .loading-dots span,
          .msg-row,
          .input-box.loading {
            animation: none;
          }
          .suggestion-card {
            transition: background-color 0.15s ease, border-color 0.15s ease;
          }
        }
      `}</style>
    </div>
  );
}
