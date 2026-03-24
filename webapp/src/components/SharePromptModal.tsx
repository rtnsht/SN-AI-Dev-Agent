"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Download, Linkedin, Loader2, RefreshCw, Share2, Sparkles, Twitter, X } from "lucide-react";

import {
  buildShareHeadline,
  buildShareMessage,
  buildShareSubline,
  normalizeShareMetrics,
  sanitizeHashtag,
  SHARE_APP_URL,
  SHARE_FALLBACK_TAG,
  type ShareMetrics,
} from "@/lib/share-content";

interface SharePromptModalProps {
  open: boolean;
  sessionId: string;
  stats: ShareMetrics;
  preGeneratedImageUrl?: string | null;
  /** When true, background image generation is in progress — modal waits instead of firing its own request */
  backgroundImageLoading?: boolean;
  onClose: () => void;
  onShared: (platform: "linkedin" | "x") => Promise<void>;
}

function CssFallbackCard({ metrics }: { metrics: ShareMetrics }) {
  const normalized = normalizeShareMetrics(metrics);
  const headline = buildShareHeadline(normalized);
  const subline = buildShareSubline(normalized);
  const domain = SHARE_APP_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const allTags = ["#servicenow", "#ai"];
  const aiTag = sanitizeHashtag(normalized.aiTag);
  if (aiTag && !allTags.includes(aiTag)) allTags.push(aiTag);

  return (
    <div
      className="relative flex flex-col justify-between overflow-hidden p-7 min-h-[270px]"
      style={{
        background: "linear-gradient(135deg, #080e1e 0%, #0d1830 45%, #182b58 100%)",
        color: "#f8fafc",
      }}
    >
      <div className="absolute rounded-full" style={{ top: -60, right: -40, width: 200, height: 200, background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)" }} />
      <div className="absolute rounded-full" style={{ bottom: -80, left: -30, width: 180, height: 180, background: "radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)" }} />

      <div className="relative flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-r-v10.svg" alt="" width={36} height={36} className="rounded-lg" />
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#93c5fd" }}>SN AI Agent</div>
          <div className="text-[10px]" style={{ color: "#4b6a94" }}>Say it. Ship it.</div>
        </div>
      </div>

      <div className="relative mt-4 space-y-2">
        <div className="text-[18px] font-bold leading-tight tracking-tight">{headline}</div>
        <div className="text-[12px]" style={{ color: "#8b9fc4" }}>{subline}</div>
        <div className="flex gap-2 flex-wrap pt-1">
          {[
            `${normalized.durationMin} min session`,
            `${normalized.phaseCount} SDLC stages`,
            `${normalized.toolCount} AI-guided ops`,
          ].map((label) => (
            <span
              key={label}
              className="rounded-full px-2.5 py-1 text-[10px] font-medium"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "#c1cfe0",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div
        className="relative flex justify-between items-end pt-3 mt-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <span className="text-[11px] font-medium" style={{ color: "#4b6a94" }}>{domain}</span>
        <span className="text-[11px] font-medium" style={{ color: "#7dd3fc" }}>{allTags.join("  ")}</span>
      </div>
    </div>
  );
}

export default function SharePromptModal({
  open,
  sessionId,
  stats,
  preGeneratedImageUrl,
  backgroundImageLoading,
  onClose,
  onShared,
}: SharePromptModalProps) {
  const [aiTag, setAiTag] = useState<string>(SHARE_FALLBACK_TAG);
  const [tagLoading, setTagLoading] = useState(false);
  const [tagReady, setTagReady] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTouched, setMessageTouched] = useState(false);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [cardSource, setCardSource] = useState<"satori" | "gemini" | null>(null);
  const [assetLoading, setAssetLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardRetryCount, setCardRetryCount] = useState(0);
  const [geminiUnavailable, setGeminiUnavailable] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [sharingPlatform, setSharingPlatform] = useState<"linkedin" | "x" | null>(null);
  const tagGenerationDoneRef = useRef(false);
  const cardPreviewObjectUrlRef = useRef<string | null>(null);

  const shareStats = useMemo(
    () => ({ ...stats, aiTag }),
    [aiTag, stats]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useLayoutEffect(() => {
    if (!open) {
      tagGenerationDoneRef.current = false;
      return;
    }
    tagGenerationDoneRef.current = false;
    setAiTag(SHARE_FALLBACK_TAG);
    setMessage("");
    setMessageTouched(false);
    setStatusNotice(null);
    setSharingPlatform(null);
    setCardBlob(null);
    setCardPreviewUrl(null);
    setCardSource(null);
    setCardError(null);
    setCardRetryCount(0);
    setGeminiUnavailable(false);
    setTagReady(false);
    if (cardPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(cardPreviewObjectUrlRef.current);
      cardPreviewObjectUrlRef.current = null;
    }

    // Use pre-generated image if available
    if (preGeneratedImageUrl) {
      setCardPreviewUrl(preGeneratedImageUrl);
      setCardSource("satori");
      fetch(preGeneratedImageUrl)
        .then(r => r.blob())
        .then(blob => setCardBlob(blob))
        .catch(() => {});
    }
  }, [open, sessionId, preGeneratedImageUrl]);

  // AI hashtag generation
  useEffect(() => {
    if (!open || tagLoading || tagGenerationDoneRef.current) return;
    if (aiTag !== SHARE_FALLBACK_TAG) {
      tagGenerationDoneRef.current = true;
      return;
    }
    setTagLoading(true);
    fetch("/api/generate-share-tag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        durationMin: stats.durationMin,
        phaseCount: stats.phaseCount,
        toolCount: stats.toolCount,
        assistantCount: stats.assistantCount,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`generate-share-tag ${response.status}`);
        return response.json() as Promise<{ tag?: string }>;
      })
      .then((data) => setAiTag(sanitizeHashtag(data.tag)))
      .catch(() => setAiTag(SHARE_FALLBACK_TAG))
      .finally(() => {
        setTagLoading(false);
        tagGenerationDoneRef.current = true;
        setTagReady(true);
      });
  }, [aiTag, open, sessionId, stats.assistantCount, stats.durationMin, stats.phaseCount, stats.toolCount, tagLoading]);

  // Draft message
  useEffect(() => {
    if (!open || messageTouched) return;
    setMessage(buildShareMessage(shareStats));
  }, [messageTouched, open, shareStats]);

  // Satori image generation — fires once tagReady, skips if pre-generated or background loading
  useEffect(() => {
    if (!open) return;
    if (preGeneratedImageUrl) return;
    if (backgroundImageLoading) return;
    if (!tagReady) return;

    const controller = new AbortController();
    setAssetLoading(true);
    setCardError(null);

    fetch("/api/share-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        sessionId,
        durationMin: stats.durationMin,
        phaseCount: stats.phaseCount,
        toolCount: stats.toolCount,
        assistantCount: stats.assistantCount,
        tag: sanitizeHashtag(aiTag),
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`share-image ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (data.fallback) return; // Keep showing CSS fallback
        if (data.imageBase64 && data.mimeType) {
          const blob = new Blob(
            [Uint8Array.from(atob(data.imageBase64), c => c.charCodeAt(0))],
            { type: data.mimeType },
          );
          if (cardPreviewObjectUrlRef.current) URL.revokeObjectURL(cardPreviewObjectUrlRef.current);
          const previewUrl = URL.createObjectURL(blob);
          cardPreviewObjectUrlRef.current = previewUrl;
          setCardBlob(blob);
          setCardPreviewUrl(previewUrl);
          setCardSource(data.source === "gemini" ? "gemini" : "satori");
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("[share-modal] Failed to generate image:", error);
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("429")) setCardError("Too many requests. Please wait a moment and retry.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setAssetLoading(false);
      });

    return () => { controller.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId, tagReady, cardRetryCount, stats.durationMin, stats.phaseCount, stats.toolCount, stats.assistantCount, preGeneratedImageUrl, backgroundImageLoading]);

  // Generate with Gemini AI (user-initiated)
  const handleGenerateWithAI = useCallback(async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setCardError(null);
    try {
      const response = await fetch("/api/share-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          durationMin: stats.durationMin,
          phaseCount: stats.phaseCount,
          toolCount: stats.toolCount,
          assistantCount: stats.assistantCount,
          tag: sanitizeHashtag(aiTag),
          useAI: true,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as Record<string, unknown>;
        if (response.status === 503 && data.geminiUnavailable) {
          setGeminiUnavailable(true);
          setCardError("AI image generation is not available on this server.");
        } else if (response.status === 429) {
          setCardError("Too many requests. Please wait a moment and retry.");
        } else {
          setCardError("AI generation failed. The regular card is shown instead.");
        }
        return;
      }
      const data = await response.json();
      if (data.imageBase64 && data.mimeType) {
        const blob = new Blob(
          [Uint8Array.from(atob(data.imageBase64), c => c.charCodeAt(0))],
          { type: data.mimeType },
        );
        if (cardPreviewObjectUrlRef.current) URL.revokeObjectURL(cardPreviewObjectUrlRef.current);
        const previewUrl = URL.createObjectURL(blob);
        cardPreviewObjectUrlRef.current = previewUrl;
        setCardBlob(blob);
        setCardPreviewUrl(previewUrl);
        setCardSource("gemini");
        setCardError(null);
      } else {
        setCardError("AI returned no image. The regular card is shown instead.");
      }
    } catch (err) {
      console.error("[share-modal] AI generation error:", err);
      setCardError("AI generation failed. Please try again.");
    } finally {
      setAiLoading(false);
    }
  }, [aiLoading, aiTag, sessionId, stats]);

  const copySharePayload = useCallback(async () => {
    let copiedText = false;
    const copiedImage = false;
    if (!navigator.clipboard) return { copiedText, copiedImage };
    if (cardBlob && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([message], { type: "text/plain" }),
            [cardBlob.type]: cardBlob,
          }),
        ]);
        return { copiedText: true, copiedImage: true };
      } catch { /* fall through */ }
    }
    try {
      await navigator.clipboard.writeText(message);
      copiedText = true;
    } catch { copiedText = false; }
    return { copiedText, copiedImage };
  }, [cardBlob, message]);

  const handleDownload = useCallback(() => {
    if (!cardBlob) return;
    const objectUrl = URL.createObjectURL(cardBlob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "sn-ai-agent-share-card.png";
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }, [cardBlob]);

  const handlePlatformShare = useCallback(
    async (platform: "linkedin" | "x") => {
      const shareText = message.trim() || buildShareMessage(shareStats);
      const shareUrl =
        platform === "linkedin"
          ? new URL("https://www.linkedin.com/feed/")
          : new URL("https://twitter.com/intent/tweet");
      if (platform === "linkedin") shareUrl.searchParams.set("shareActive", "true");
      shareUrl.searchParams.set("text", shareText);
      window.open(shareUrl.toString(), "_blank", "noopener,noreferrer");
      setSharingPlatform(platform);
      try {
        const copied = await copySharePayload();
        if (platform === "linkedin") {
          setStatusNotice(
            copied.copiedImage
              ? "LinkedIn opened. Your message and image are ready to paste if needed."
              : copied.copiedText
                ? "LinkedIn opened. Your message is copied, and the image can be downloaded below."
                : "LinkedIn opened. If the draft looks empty, paste the copied message manually."
          );
        } else {
          setStatusNotice(
            copied.copiedImage
              ? "X opened with the draft. The image is also ready to paste."
              : copied.copiedText
                ? "X opened with the draft. Your message is copied as a fallback."
                : "X opened with the drafted post."
          );
        }
        await onShared(platform);
      } finally {
        setSharingPlatform(null);
      }
    },
    [copySharePayload, message, onShared, shareStats]
  );

  if (!open) return null;

  // Image preview section: always show CSS card as base layer; overlay PNG when ready
  const showPng = !!cardPreviewUrl;
  const isPngLoading = assetLoading && !showPng;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-3 sm:px-5"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-4xl rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-xl)",
          maxHeight: "calc(100vh - 2rem)",
        }}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <div>
            <div className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
              You built something worth talking about
            </div>
            <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              Your workflow is ready to share. Edit the post below and put it in front of the people who get it.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-md transition-colors"
            style={{ width: 32, height: 32, color: "var(--text-secondary)" }}
            aria-label="Close share dialog"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 sm:px-5 py-4 sm:py-5 space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-5">
            <div className="space-y-3">
              {/* Card preview: CSS card always visible; PNG replaces it when ready */}
              <div
                className="rounded-2xl overflow-hidden relative"
                style={{
                  background: "var(--surface-secondary)",
                  border: "1px solid var(--border-default)",
                  minHeight: 250,
                }}
              >
                {/* CSS card — always shown as base */}
                <CssFallbackCard metrics={shareStats} />

                {/* PNG overlay — fades in when ready */}
                {showPng && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cardPreviewUrl}
                    alt="Share card"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ animation: "fadeIn 0.3s ease" }}
                  />
                )}

                {/* Loading shimmer overlay while PNG is being generated */}
                {isPngLoading && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                    style={{ background: "rgba(8,14,30,0.55)", backdropFilter: "blur(2px)" }}
                  >
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#93c5fd" }} />
                    <span className="text-[12px] font-medium" style={{ color: "#93c5fd" }}>Rendering card…</span>
                  </div>
                )}

                {/* AI generation loading overlay */}
                {aiLoading && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                    style={{ background: "rgba(8,14,30,0.65)", backdropFilter: "blur(2px)" }}
                  >
                    <Sparkles className="w-5 h-5 animate-pulse" style={{ color: "#a78bfa" }} />
                    <span className="text-[12px] font-medium" style={{ color: "#a78bfa" }}>Generating with AI…</span>
                    <span className="text-[11px]" style={{ color: "rgba(167,139,250,0.65)" }}>This takes ~15–30 seconds</span>
                  </div>
                )}
              </div>

              {/* Error message */}
              {cardError && (
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px]"
                  style={{
                    background: "color-mix(in srgb, var(--color-error, #ef4444) 8%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-error, #ef4444) 20%, transparent)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-error, #ef4444)" }} />
                  <span>{cardError}</span>
                  {!geminiUnavailable && (
                    <button
                      type="button"
                      onClick={() => { setCardError(null); setCardRetryCount(c => c + 1); }}
                      className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-80 shrink-0"
                      style={{ color: "var(--color-primary)" }}
                    >
                      <RefreshCw className="w-3 h-3" strokeWidth={2} />
                      Retry
                    </button>
                  )}
                </div>
              )}

              {/* Source badge + AI regenerate button */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={!cardBlob && !showPng}
                    className="inline-flex items-center gap-2 text-[12px] font-medium disabled:opacity-40 transition-opacity hover:opacity-80"
                    style={{ color: "var(--color-primary)" }}
                  >
                    <Download className="w-3.5 h-3.5" strokeWidth={1.8} />
                    Download image
                  </button>
                  {cardSource && (
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: cardSource === "gemini" ? "rgba(167,139,250,0.12)" : "rgba(96,165,250,0.10)",
                        color: cardSource === "gemini" ? "#a78bfa" : "#60a5fa",
                        border: `1px solid ${cardSource === "gemini" ? "rgba(167,139,250,0.2)" : "rgba(96,165,250,0.18)"}`,
                      }}
                    >
                      {cardSource === "gemini" ? "✨ AI" : "⚡ Fast"}
                    </span>
                  )}
                </div>

                {!geminiUnavailable && (
                  <button
                    type="button"
                    onClick={() => void handleGenerateWithAI()}
                    disabled={aiLoading || assetLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all disabled:opacity-50 hover:opacity-90"
                    style={{
                      background: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(59,130,246,0.15) 100%)",
                      border: "1px solid rgba(124,58,237,0.25)",
                      color: "#a78bfa",
                    }}
                  >
                    {aiLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {cardSource === "gemini" ? "Regenerate with AI" : "Generate with AI"}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-[12px] font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                  Draft post
                </div>
                <textarea
                  value={message}
                  onChange={(event) => { setMessageTouched(true); setMessage(event.target.value); }}
                  className="w-full rounded-xl p-3.5 resize-y min-h-[220px] text-[13px] leading-6"
                  style={{
                    background: "var(--surface-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-default)",
                    outline: "none",
                  }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void handlePlatformShare("linkedin")}
                  disabled={sharingPlatform !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-medium transition-opacity disabled:opacity-60"
                  style={{ background: "#0A66C2", color: "#ffffff" }}
                >
                  {sharingPlatform === "linkedin" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Linkedin className="w-4 h-4" strokeWidth={2} />}
                  Share on LinkedIn
                </button>
                <button
                  type="button"
                  onClick={() => void handlePlatformShare("x")}
                  disabled={sharingPlatform !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-medium transition-opacity disabled:opacity-60"
                  style={{ background: "#111827", color: "#ffffff", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  {sharingPlatform === "x" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Twitter className="w-4 h-4" strokeWidth={2} />}
                  Share on X
                </button>
              </div>

              <div
                className="rounded-xl px-3 py-2.5 text-[12px]"
                style={{
                  background: "color-mix(in srgb, var(--color-info) 8%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--color-info) 18%, transparent)",
                  color: "var(--text-secondary)",
                }}
              >
                {tagLoading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating an AI hashtag...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                    Your AI-generated tag is <strong style={{ color: "var(--text-primary)" }}>{sanitizeHashtag(aiTag)}</strong>
                  </span>
                )}
              </div>

              {statusNotice && (
                <div
                  className="rounded-xl px-3 py-2.5 text-[12px]"
                  style={{
                    background: "color-mix(in srgb, var(--color-success) 9%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-success) 18%, transparent)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {statusNotice}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

