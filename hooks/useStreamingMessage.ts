"use client";

import { useCallback, useRef, useEffect } from "react";

const STREAMING_INTERVAL = 25;
const STREAMING_CHARS_PER_TICK = 2;

export interface StreamingMessage {
  id: string;
  content: string;
  streaming?: boolean;
}

export interface UseStreamingMessageOptions<T extends StreamingMessage> {
  setMessages: React.Dispatch<React.SetStateAction<T[]>>;
}

/**
 * Hook for managing streaming text animation
 * Simulates typing effect by gradually revealing text
 */
export function useStreamingMessage<T extends StreamingMessage>({
  setMessages,
}: UseStreamingMessageOptions<T>) {
  const streamingTimersRef = useRef<ReturnType<typeof setInterval>[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamingTimersRef.current.forEach((timer) => clearInterval(timer));
      streamingTimersRef.current = [];
    };
  }, []);

  const startStreaming = useCallback(
    (messageId: string, fullText: string) => {
      if (!fullText) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, streaming: false } : msg
          )
        );
        return;
      }

      let currentLength = 0;
      const timer = setInterval(() => {
        currentLength = Math.min(
          fullText.length,
          currentLength + STREAMING_CHARS_PER_TICK
        );

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  content: fullText.slice(0, currentLength),
                  streaming: currentLength < fullText.length,
                }
              : msg
          )
        );

        if (currentLength >= fullText.length) {
          clearInterval(timer);
          streamingTimersRef.current = streamingTimersRef.current.filter(
            (handle) => handle !== timer
          );
        }
      }, STREAMING_INTERVAL);

      streamingTimersRef.current.push(timer);
    },
    [setMessages]
  );

  const stopAllStreaming = useCallback(() => {
    streamingTimersRef.current.forEach((timer) => clearInterval(timer));
    streamingTimersRef.current = [];
  }, []);

  return {
    startStreaming,
    stopAllStreaming,
  };
}
