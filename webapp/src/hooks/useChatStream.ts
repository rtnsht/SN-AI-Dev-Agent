'use client';

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, AIProvider } from '@/lib/types';

export interface UseChatStreamOptions {
  provider?: AIProvider;
  model?: string;
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
}

export interface UseChatStreamReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, options?: { images?: string[]; files?: File[] }) => Promise<void>;
  clearMessages: () => void;
  abort: () => void;
}

export function useChatStream(options: UseChatStreamOptions = {}): UseChatStreamReturn {
  const { provider = 'anthropic', model, onMessage, onError, onComplete } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string, msgOptions?: { images?: string[]; files?: File[] }) => {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      images: msgOptions?.images,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/api/agent-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          provider,
          model,
          images: msgOptions?.images,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Request failed');
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('No response stream');
      }

      let assistantContent = '';
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              assistantContent += parsed.content;
              setMessages(prev => prev.map(m =>
                m.id === assistantMessage.id
                  ? { ...m, content: assistantContent }
                  : m
              ));
            }
          } catch {
            // Ignore parse errors for malformed chunks
          }
        }
      }

      const finalMessage = { ...assistantMessage, content: assistantContent };
      onMessage?.(finalMessage);
      onComplete?.();
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        return; // Ignore abort errors
      }
      const errorMsg = e instanceof Error ? e.message : 'Request failed';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [provider, model, onMessage, onError, onComplete]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages, abort };
}
