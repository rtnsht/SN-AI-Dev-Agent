"use client";

import { useState, useRef, useEffect, useCallback, type RefObject } from "react";
import Image from "next/image";
import type { ChatMessage, SDLCPhase, LiveStatus, FileAttachment } from "@/lib/types";
import MessageBubble from "./MessageBubble";

/* ── Web Speech API type shim ── */
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}
type SpeechRecognitionCtor = new () => SpeechRecognition;
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

/** Detect browser SpeechRecognition support */
function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const MAX_RECORDING_MS = 2 * 60 * 1000; // 2 minute hard cap

const DEFAULT_PROMPTS = [
  { icon: "🏗️", text: "Build a high-priority incident justification feature that requires managers to provide a business reason when setting incident priority to P1", desc: "Full SDLC requirement" },
  { icon: "📦", text: "Create a catalog item for requesting a new laptop with approval workflow", desc: "Full SDLC requirement" },
  { icon: "🔍", text: "Analyze my instance health and show me any anti-patterns", desc: "Instance analysis" },
  { icon: "📊", text: "List all custom business rules on the incident table", desc: "Quick query" },
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB per image
const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per document
const MAX_FILES = 5;

/** Accepted document MIME types */
const DOC_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

/** File extension to icon mapping */
function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "📄";
  if (ext === "doc" || ext === "docx") return "📝";
  if (ext === "xls" || ext === "xlsx") return "📊";
  return "📎";
}

/** Read a File as base64 data URI */
function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Read a File as raw base64 (no data-URI prefix) */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      // Strip the "data:...;base64," prefix
      const base64 = dataUri.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (text: string, images?: string[], files?: FileAttachment[]) => void;
  onCancel: () => void;
  onApprove: (phase: SDLCPhase) => void;
  onChoiceSelect?: (choiceKey: string) => void;
  connected: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  /** When false, tool executions show only a compact summary (controlled by env) */
  showToolDetails?: boolean;
  /** Live status during streaming (tool execution updates) */
  liveStatus?: LiveStatus | null;
  /** Authenticated user's display name (from ServiceNow connection) */
  userName?: string;
  /** Dynamic example prompts generated from instance data */
  instancePrompts?: { icon: string; text: string; desc: string }[];
}

export default function ChatWindow({ messages, isLoading, onSend, onCancel, onApprove, onChoiceSelect, connected, inputRef, showToolDetails = true, liveStatus, userName, instancePrompts }: Props) {
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  /* ── Voice input state ── */
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Accumulates finalized transcript segments across onresult events
  const finalTranscriptRef = useRef("");

  /** Check browser support on mount */
  useEffect(() => {
    setSpeechSupported(getSpeechRecognition() !== null);
  }, []);

  /** Cleanup on unmount */
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    setRecordingSeconds(0);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
  }, []);

  const startRecording = useCallback(() => {
    const SRCtor = getSpeechRecognition();
    if (!SRCtor) return;

    const recognition = new SRCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;
    finalTranscriptRef.current = input; // preserve existing text

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      // Show finalized + current interim in textarea
      setInput(finalTranscriptRef.current + interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn("SpeechRecognition error:", event.error);
      // "no-speech" and "aborted" are non-fatal — just stop gracefully
      stopRecording();
    };

    recognition.onend = () => {
      // Browser may auto-stop (e.g. silence); sync state
      setIsRecording(false);
      setRecordingSeconds(0);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    };

    recognition.start();
    setIsRecording(true);
    setRecordingSeconds(0);

    // Elapsed timer (1s ticks)
    timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    // Hard cap at 2 minutes
    maxTimerRef.current = setTimeout(() => stopRecording(), MAX_RECORDING_MS);
  }, [input, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, stopRecording, startRecording]);

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
    if ((!input.trim() && images.length === 0 && files.length === 0) || isLoading) return;
    // Auto-stop recording when user sends a message
    if (isRecording) stopRecording();
    onSend(
      input.trim(),
      images.length > 0 ? images : undefined,
      files.length > 0 ? files : undefined
    );
    setInput("");
    setImages([]);
    setFiles([]);
    // Reset textarea height after sending
    if (inputRef.current) inputRef.current.style.height = "auto";
  }, [input, images, files, isLoading, isRecording, stopRecording, onSend, inputRef]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter = send, Shift+Enter = new line
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Shift+Enter allows default behavior (new line in textarea)
  };

  /** Process image files and add as base64 data URIs */
  const addImageFiles = useCallback(async (fileList: FileList | File[]) => {
    const validFiles = Array.from(fileList).filter((f) => {
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

  /** Process document files and add as FileAttachment objects */
  const addDocFiles = useCallback(async (fileList: FileList | File[]) => {
    const validFiles = Array.from(fileList).filter((f) => {
      if (!DOC_MIME_TYPES.has(f.type)) return false;
      if (f.size > MAX_FILE_SIZE) {
        console.warn(`Skipping ${f.name}: exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
        return false;
      }
      return true;
    });

    const remaining = MAX_FILES - files.length;
    const toProcess = validFiles.slice(0, remaining);
    if (toProcess.length === 0) return;

    const attachments: FileAttachment[] = await Promise.all(
      toProcess.map(async (f) => ({
        name: f.name,
        mimeType: f.type,
        data: await readFileAsBase64(f),
        size: f.size,
      }))
    );
    setFiles((prev) => [...prev, ...attachments].slice(0, MAX_FILES));
  }, [files.length]);

  /** Process any dropped/selected files -- route images vs documents */
  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    const imgFiles = arr.filter((f) => f.type.startsWith("image/"));
    const docFiles = arr.filter((f) => DOC_MIME_TYPES.has(f.type));
    if (imgFiles.length > 0) await addImageFiles(imgFiles);
    if (docFiles.length > 0) await addDocFiles(docFiles);
  }, [addImageFiles, addDocFiles]);

  /** Handle paste — intercept images and documents from clipboard */
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/") || DOC_MIME_TYPES.has(item.type)) {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      addFiles(pastedFiles);
    }
  }, [addFiles]);

  /** Handle drag & drop */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const showEmptyState = messages.every((m) => m.role === "system");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {showEmptyState && (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center max-w-lg mx-auto">
                <div className="w-48 h-48 mx-auto -mb-1 flex items-center justify-center">
                  <Image src="/yantra-logo.png" alt="Yantra - AI Dev Agent - SN" width={192} height={192} className="rounded-full" unoptimized />
                </div>
                <h2 className="text-2xl font-bold text-gray-100 mb-1 tracking-tight">
                  Say it. Ship it.
                </h2>
                <p className="text-xs text-gray-400 tracking-widest uppercase mb-4">
                  Spec-driven &middot; Human-approved &middot; AI-powered
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  {connected
                    ? "You're connected! Describe what you need — Yantra builds, tests, and deploys it on your ServiceNow instance."
                    : "Open the settings panel, connect your instance, and tell Yantra what to build."}
                </p>
                {connected && (
                  <div className="grid grid-cols-2 gap-2">
                    {(instancePrompts && instancePrompts.length > 0 ? instancePrompts : DEFAULT_PROMPTS).map((p, i) => (
                      <button
                        key={i}
                        onClick={() => onSend(p.text)}
                        className="text-left p-3 rounded-xl bg-gray-800/50 border border-gray-800 hover:border-gray-600 hover:bg-gray-800 transition-all group overflow-hidden"
                      >
                        <span className="text-lg">{p.icon}</span>
                        <p className="text-xs text-gray-300 mt-1 group-hover:text-gray-100 transition-colors line-clamp-2 break-words">{p.text}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5 truncate">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {messages.filter((msg) => !msg.hidden).map((msg, i) => (
            <MessageBubble
              key={i}
              message={msg}
              onApprove={onApprove}
              onChoiceSelect={onChoiceSelect}
              showToolDetails={showToolDetails}
              userName={userName}
            />
          ))}

          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                AI
              </div>
              <div className="bg-gray-800/80 rounded-2xl rounded-tl-sm px-4 py-3 border border-gray-700/50">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="flex gap-1">
                    <span className={`w-2 h-2 rounded-full animate-bounce ${liveStatus?.phase === "tool" ? "bg-amber-400" : liveStatus?.phase === "responding" ? "bg-green-400" : "bg-blue-400"}`} style={{ animationDelay: "0ms" }} />
                    <span className={`w-2 h-2 rounded-full animate-bounce ${liveStatus?.phase === "tool" ? "bg-amber-400" : liveStatus?.phase === "responding" ? "bg-green-400" : "bg-blue-400"}`} style={{ animationDelay: "150ms" }} />
                    <span className={`w-2 h-2 rounded-full animate-bounce ${liveStatus?.phase === "tool" ? "bg-amber-400" : liveStatus?.phase === "responding" ? "bg-green-400" : "bg-blue-400"}`} style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-xs text-gray-500">
                    {liveStatus ? (
                      <span className="flex items-center gap-1.5">
                        {liveStatus.phase === "tool" && <span className="text-amber-400">🔧</span>}
                        {liveStatus.phase === "thinking" && <span className="text-blue-400">💭</span>}
                        {liveStatus.phase === "responding" && <span className="text-green-400">✍️</span>}
                        {liveStatus.message}
                      </span>
                    ) : (
                      "Thinking & executing tools..."
                    )}
                  </span>
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

          {/* Document file previews */}
          {files.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {files.map((f, i) => (
                <div key={i} className="relative group flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                  <span className="text-lg">{fileIcon(f.name)}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs text-gray-300 truncate max-w-[120px]">{f.name}</span>
                    <span className="text-[10px] text-gray-500">{formatSize(f.size)}</span>
                  </div>
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove file"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Drag overlay hint */}
          {dragOver && (
            <div className="mb-2 py-3 border-2 border-dashed border-blue-500/50 rounded-xl text-center text-xs text-blue-400">
              Drop images or documents here
            </div>
          )}

          {/* Recording indicator -- prominent bar with clear controls */}
          {isRecording && (
            <div className="flex items-center gap-3 mb-2 px-4 py-2.5 bg-red-950/60 border border-red-500/40 rounded-xl">
              {/* Pulsing red dot */}
              <span className="relative flex h-3 w-3 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              {/* Timer */}
              <span className="font-mono tabular-nums text-sm text-red-200 font-medium">
                {Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:{(recordingSeconds % 60).toString().padStart(2, "0")}
              </span>
              {/* Waveform animation bars */}
              <div className="flex items-center gap-[3px] h-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="w-[3px] bg-red-400/80 rounded-full"
                    style={{
                      animation: `voiceBar 0.8s ease-in-out ${i * 0.12}s infinite alternate`,
                      height: "40%",
                    }}
                  />
                ))}
              </div>
              <span className="text-xs text-red-300/80 ml-1">Listening...</span>
              {/* Remaining time */}
              <span className="ml-auto text-red-400/50 text-[10px] tabular-nums">
                {Math.floor((MAX_RECORDING_MS / 1000 - recordingSeconds) / 60)}:{((MAX_RECORDING_MS / 1000 - recordingSeconds) % 60).toString().padStart(2, "0")} left
              </span>
              {/* Stop button */}
              <button
                onClick={stopRecording}
                className="ml-1 px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
              >
                Stop
              </button>
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
            {/* Document upload button */}
            <button
              onClick={() => docInputRef.current?.click()}
              disabled={!connected || isLoading || files.length >= MAX_FILES}
              className="p-3 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              title="Attach document (PDF, Word, Excel)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) addDocFiles(e.target.files); e.target.value = ""; }}
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

            {/* Voice input button — right side, adjacent to send */}
            {speechSupported && (
              <button
                onClick={toggleRecording}
                disabled={!connected || isLoading}
                className={`flex items-center gap-1.5 rounded-xl transition-all flex-shrink-0 ${
                  isRecording
                    ? "px-3 py-2.5 bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30"
                    : "p-3 text-gray-400 hover:text-red-300 hover:bg-red-950/30 border border-transparent hover:border-red-500/20"
                } disabled:opacity-30 disabled:cursor-not-allowed`}
                title={isRecording ? "Stop recording" : "Voice input (speech-to-text)"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isRecording ? (
                    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
                  )}
                </svg>
                {isRecording && <span className="text-xs font-medium">Stop</span>}
              </button>
            )}
            {!speechSupported && (
              <div className="p-3 text-gray-600 flex-shrink-0 cursor-not-allowed" title="Voice input not supported. Use Chrome or Edge.">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
              </div>
            )}

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
                disabled={!connected || (!input.trim() && images.length === 0 && files.length === 0)}
                className="p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl transition-colors flex-shrink-0"
                title="Send (Enter)"
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
                <kbd className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-400/40 rounded text-[11px] text-blue-200 font-mono font-bold shadow-sm shadow-blue-500/10">Enter</kbd>
                <span className="ml-0.5 text-blue-200">to Send</span>
              </span>
              <span className="text-indigo-500/60">│</span>
              <span className="flex items-center gap-1.5 font-bold text-gray-200">
                <kbd className="px-1.5 py-0.5 bg-gray-600/40 border border-gray-500/50 rounded text-[11px] text-gray-200 font-mono font-bold shadow-sm shadow-gray-700/20">⇧ Shift</kbd>
                <span className="text-gray-400/80">+</span>
                <kbd className="px-1.5 py-0.5 bg-gray-600/40 border border-gray-500/50 rounded text-[11px] text-gray-200 font-mono font-bold shadow-sm shadow-gray-700/20">Enter</kbd>
                <span className="ml-0.5 text-gray-300">for New Line</span>
              </span>
              <span className="text-indigo-500/60">│</span>
              <span className="font-bold text-gray-300">Paste or drag images/docs</span>
            </div>
            {/* Spacer matching send button width */}
            <div className="w-[44px] flex-shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}

