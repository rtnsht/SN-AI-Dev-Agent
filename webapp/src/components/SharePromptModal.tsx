"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, Linkedin, Loader2, Share2, Twitter, X } from "lucide-react";

import {
  buildShareCardUrl,
  buildShareMessage,
  sanitizeHashtag,
  SHARE_FALLBACK_TAG,
  type ShareMetrics,
} from "@/lib/share-content";

interface SharePromptModalProps {
  open: boolean;
  sessionId: string;
  stats: ShareMetrics;
  onClose: () => void;
  onShared: (platform: "linkedin" | "x") => Promise<void>;
}

export default function SharePromptModal({
  open,
  sessionId,
  stats,
  onClose,
  onShared,
}: SharePromptModalProps) {
  const [aiTag, setAiTag] = useState<string>(SHARE_FALLBACK_TAG);
  const [tagLoading, setTagLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTouched, setMessageTouched] = useState(false);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [assetLoading, setAssetLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [sharingPlatform, setSharingPlatform] = useState<"linkedin" | "x" | null>(null);
  /** One tag generation attempt per modal open (avoids infinite loop when API fails or tag stays FALLBACK). */
  const tagGenerationDoneRef = useRef(false);
  /** Tracks blob URL for cleanup if effect unmounts mid-fetch. */
  const cardPreviewObjectUrlRef = useRef<string | null>(null);

  const shareStats = useMemo(
    () => ({
      ...stats,
      aiTag,
    }),
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

  // Reset before paint so the tag-fetch effect sees FALLBACK (not stale state from last open).
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
    if (cardPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(cardPreviewObjectUrlRef.current);
      cardPreviewObjectUrlRef.current = null;
    }
  }, [open, sessionId]);

  useEffect(() => {
    if (!open || tagLoading || tagGenerationDoneRef.current) return;
    if (aiTag !== SHARE_FALLBACK_TAG) {
      tagGenerationDoneRef.current = true;
      return;
    }

    setTagLoading(true);
    setStatusNotice(null);
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
      .then((data) => {
        setAiTag(sanitizeHashtag(data.tag));
      })
      .catch(() => {
        setAiTag(SHARE_FALLBACK_TAG);
      })
      .finally(() => {
        setTagLoading(false);
        tagGenerationDoneRef.current = true;
      });
  }, [aiTag, open, sessionId, stats.assistantCount, stats.durationMin, stats.phaseCount, stats.toolCount, tagLoading]);

  useEffect(() => {
    if (!open) return;
    if (messageTouched) return;
    setMessage(buildShareMessage(shareStats));
  }, [messageTouched, open, shareStats]);

  useEffect(() => {
    if (!open) return;

    const url = buildShareCardUrl(sessionId, {
      durationMin: stats.durationMin,
      phaseCount: stats.phaseCount,
      toolCount: stats.toolCount,
      assistantCount: stats.assistantCount,
      aiTag,
    });
    const controller = new AbortController();

    setAssetLoading(true);
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`share-card ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (cardPreviewObjectUrlRef.current) {
          URL.revokeObjectURL(cardPreviewObjectUrlRef.current);
          cardPreviewObjectUrlRef.current = null;
        }
        const previewUrl = URL.createObjectURL(blob);
        cardPreviewObjectUrlRef.current = previewUrl;
        setCardBlob(blob);
        setCardPreviewUrl(previewUrl);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("[share-modal] Failed to load card:", error);
        setCardBlob(null);
        setCardPreviewUrl(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setAssetLoading(false);
        }
      });

    return () => {
      controller.abort();
      if (cardPreviewObjectUrlRef.current) {
        URL.revokeObjectURL(cardPreviewObjectUrlRef.current);
        cardPreviewObjectUrlRef.current = null;
      }
    };
  }, [
    open,
    sessionId,
    aiTag,
    stats.durationMin,
    stats.phaseCount,
    stats.toolCount,
    stats.assistantCount,
  ]);

  const copySharePayload = useCallback(async () => {
    let copiedText = false;
    const copiedImage = false;

    if (!navigator.clipboard) {
      return { copiedText, copiedImage };
    }

    if (cardBlob && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([message], { type: "text/plain" }),
            [cardBlob.type]: cardBlob,
          }),
        ]);
        return { copiedText: true, copiedImage: true };
      } catch {
        // Fall through to text-only copy.
      }
    }

    try {
      await navigator.clipboard.writeText(message);
      copiedText = true;
    } catch {
      copiedText = false;
    }

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

      if (platform === "linkedin") {
        shareUrl.searchParams.set("shareActive", "true");
      }
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-3 sm:px-5"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
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
              Share your session
            </div>
            <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              Edit the copy, then post it directly to LinkedIn or X.
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
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "var(--surface-secondary)",
                  border: "1px solid var(--border-default)",
                  minHeight: 250,
                }}
              >
                {cardPreviewUrl ? (
                  <img
                    src={cardPreviewUrl}
                    alt="SN AI Agent share card preview"
                    className="block w-full h-auto"
                  />
                ) : (
                  <div
                    className="flex items-center justify-center gap-2 h-full min-h-[250px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <Loader2 className={`w-4 h-4 ${assetLoading ? "animate-spin" : ""}`} />
                    Preparing your share card...
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleDownload}
                disabled={!cardBlob}
                className="inline-flex items-center gap-2 text-[12px] font-medium disabled:opacity-50"
                style={{ color: "var(--color-primary)" }}
              >
                <Download className="w-3.5 h-3.5" strokeWidth={1.8} />
                Download image
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-[12px] font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                  Draft post
                </div>
                <textarea
                  value={message}
                  onChange={(event) => {
                    setMessageTouched(true);
                    setMessage(event.target.value);
                  }}
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
                  style={{
                    background: "#0A66C2",
                    color: "#ffffff",
                  }}
                >
                  {sharingPlatform === "linkedin" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Linkedin className="w-4 h-4" strokeWidth={2} />
                  )}
                  Share on LinkedIn
                </button>

                <button
                  type="button"
                  onClick={() => void handlePlatformShare("x")}
                  disabled={sharingPlatform !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-medium transition-opacity disabled:opacity-60"
                  style={{
                    background: "#111827",
                    color: "#ffffff",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  {sharingPlatform === "x" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Twitter className="w-4 h-4" strokeWidth={2} />
                  )}
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
    </div>
  );
}
