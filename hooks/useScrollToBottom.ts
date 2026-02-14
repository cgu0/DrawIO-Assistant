"use client";

import { useRef, useEffect, useState, useCallback } from "react";

const BOTTOM_THRESHOLD = 60;

interface UseScrollToBottomReturn {
  messagesEndRef: React.RefObject<HTMLDivElement>;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  isAtBottom: boolean;
  scrollToBottom: () => void;
}

/**
 * Hook for smart auto-scrolling:
 * - Auto-scrolls to bottom when new items are added (only if user is near bottom)
 * - Suppresses auto-scroll when user has scrolled up
 * - Exposes isAtBottom state and scrollToBottom() for a floating button
 */
export function useScrollToBottom(itemCount: number): UseScrollToBottomReturn {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  }, []);

  // Listen for scroll events on the container
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const nearBottom = scrollHeight - scrollTop - clientHeight <= BOTTOM_THRESHOLD;
      setIsAtBottom(nearBottom);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll only when near bottom and new items added
  useEffect(() => {
    if (itemCount > prevCountRef.current && isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCountRef.current = itemCount;
  }, [itemCount, isAtBottom]);

  return { messagesEndRef, scrollContainerRef, isAtBottom, scrollToBottom };
}
