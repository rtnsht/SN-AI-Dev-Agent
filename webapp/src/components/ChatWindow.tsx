"use client";

import { useState, useRef, useEffect, useCallback, type RefObject } from "react";
import type { ChatMessage, SDLCPhase } from "@/lib/types";
import MessageBubble from "./MessageBubble";

const EXAMPLE_PROMPTS = [
  { icon: "🏗️", text: "Build a high-priority incident justification feature that requires managers to provide a business reason when setting incident priority to P1", desc: "Full SDLC requirement" },
  { icon: "📦", text: "Create a catalog item for requesting a new laptop with approval workflow", desc: "Full SDLC requirement" },
  { icon: "🔍", text: "Analyze my instance health and show me any anti-patterns", desc: "Instance analysis" },
  { icon: "📊", text: "List all custom business rules on the incident table", desc: "Quick query" },
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB per image
const MAX_IMAGES = 5;

/** Read a File as base64 data URI */
function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (text: string, images?: string[]) => void;
  onCancel: () => void;
  onApprove: (phase: SDLCPhase) => void;
  connected: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}

export default function ChatWindow({ messages, isLoading, onSend, onCancel, onApprove, connected, inputRef }: Props) {
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    // Clamp between 1 row (~40px) and 50vh
    const maxH = window.innerHeight * 0.5;
    ta.style.height = `${Math.min(ta.scrollHeight, maxH)}px`;
  }, [input, inputRef]);

  const handleSubmit = useCallback(() => {
    if ((!input.trim() && images.length === 0) || isLoading) return;
    onSend(input.trim(), images.length > 0 ? images : undefined);
    setInput("");
    setImages([]);
    // Reset textarea height after sending
    if (inputRef.current) inputRef.current.style.height = "auto";
  }, [input, images, isLoading, onSend, inputRef]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Shift+Enter = send, plain Enter = new line
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  /** Process image files and add as base64 data URIs */
  const addImageFiles = useCallback(async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((f) => {
      if (!f.type.startsWith("image/")) return false;
      if (f.size > MAX_IMAGE_SIZE) {
        console.warn(`Skipping ${f.name}: exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);
        return false;
      }
      return true;
    });

    const remaining = MAX_IMAGES - images.length;
    const toProcess = validFiles.slice(0, remaining);
    if (toProcess.length === 0) return;

    const dataUris = await Promise.all(toProcess.map(readFileAsDataUri));
    setImages((prev) => [...prev, ...dataUris].slice(0, MAX_IMAGES));
  }, [images.length]);

  /** Handle paste — intercept images from clipboard */
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      addImageFiles(imageFiles);
    }
  }, [addImageFiles]);

  /** Handle drag & drop */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files) {
      addImageFiles(e.dataTransfer.files);
    }
  }, [addImageFiles]);

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const showEmptyState = messages.length === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {showEmptyState && (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center max-w-lg mx-auto">
                <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl">⚡</span>
                </div>
                <h2 className="text-xl font-semibold text-gray-200 mb-2">
                  ServiceNow AI Dev Agent
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  {connected
                    ? "You're connected! Ask me anything — query records, create scripts, analyze code quality, manage update sets, and more."
                    : "Connect to your ServiceNow instance using the settings panel, then start chatting."}
                </p>
                {connected && (
                  <div className="grid grid-cols-2 gap-2">
                    {EXAMPLE_PROMPTS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => onSend(p.text)}
                        className="text-left p-3 rounded-xl bg-gray-800/50 border border-gray-800 hover:border-gray-600 hover:bg-gray-800 transition-all group"
                      >
                        <span className="text-lg">{p.icon}</span>
                        <p className="text-xs text-gray-300 mt-1 group-hover:text-gray-100 transition-colors">{p.text}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} onApprove={onApprove} />
          ))}

          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                AI
              </div>
              <div className="bg-gray-800/80 rounded-2xl rounded-tl-sm px-4 py-3 border border-gray-700/50">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-xs text-gray-500">Thinking & executing tools...</span>
                  <button
                    onClick={onCancel}
                    className="ml-2 flex items-center gap-1 px-2 py-0.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 rounded-md transition-colors"
                    title="Cancel request"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Stop
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div
        className={`border-t border-gray-800 p-4 bg-gray-900/50 transition-colors ${dragOver ? "bg-blue-900/20 border-blue-500/50" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="max-w-3xl mx-auto">
          {/* Image previews */}
          {images.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative group">
                  <img src={img} alt={`Attachment ${i + 1}`} className="h-16 w-16 object-cover rounded-lg border border-gray-700" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    ×
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-16 w-16 rounded-lg border border-dashed border-gray-600 hover:border-gray-400 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors"
                  title="Add another image"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              )}
            </div>
          )}

          {/* Drag overlay hint */}
          {dragOver && (
            <div className="mb-2 py-3 border-2 border-dashed border-blue-500/50 rounded-xl text-center text-xs text-blue-400">
              Drop images here
            </div>
          )}

          <div className="flex gap-2 items-end">
            {/* Image upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!connected || isLoading || images.length >= MAX_IMAGES}
              className="p-3 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              title="Attach image (paste or drag also works)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) addImageFiles(e.target.files); e.target.value = ""; }}
            />

            {/* Auto-growing textarea */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={connected ? "Ask me anything about your ServiceNow instance..." : "Connect first →"}
              disabled={!connected || isLoading}
              rows={1}
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none overflow-y-auto"
              style={{ maxHeight: "50vh" }}
            />

            {/* Send / Stop button */}
            {isLoading ? (
              <button
                onClick={onCancel}
                className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors flex-shrink-0"
                title="Cancel request"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!connected || (!input.trim() && images.length === 0)}
                className="p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl transition-colors flex-shrink-0"
                title="Send (Shift+Enter)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            )}
          </div>
          {/* Keyboard hints — aligned with the textarea (skip image btn + send btn columns) */}
          <div className="flex gap-2 mt-2">
            {/* Spacer matching image button width */}
            <div className="w-[44px] flex-shrink-0" />
            <div className="flex-1 flex items-center justify-center gap-5 px-4 py-1.5 rounded-lg bg-indigo-950/50 border border-indigo-500/25 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-blue-300">
                <kbd className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-400/40 rounded text-[11px] text-blue-200 font-mono font-bold shadow-sm shadow-blue-500/10">⇧ Shift</kbd>
                <span className="text-blue-400/80">+</span>
                <kbd className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-400/40 rounded text-[11px] text-blue-200 font-mono font-bold shadow-sm shadow-blue-500/10">Enter</kbd>
                <span className="ml-0.5 text-blue-200">to Send</span>
              </span>
              <span className="text-indigo-500/60">│</span>
              <span className="flex items-center gap-1.5 font-bold text-gray-200">
                <kbd className="px-1.5 py-0.5 bg-gray-600/40 border border-gray-500/50 rounded text-[11px] text-gray-200 font-mono font-bold shadow-sm shadow-gray-700/20">Enter</kbd>
                <span className="ml-0.5 text-gray-300">for New Line</span>
              </span>
              <span className="text-indigo-500/60">│</span>
              <span className="font-bold text-gray-300">📎 Paste or drag images</span>
            </div>
            {/* Spacer matching send button width */}
            <div className="w-[44px] flex-shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}

