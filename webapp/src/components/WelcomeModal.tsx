"use client";

import { useState, useEffect } from "react";
import {
  APP_NAME,
  WELCOME_TITLE,
  WELCOME_LINE_1,
  WELCOME_LINE_2,
  WELCOME_LINE_3,
  WELCOME_VIDEO_URL,
} from "@/lib/branding";

interface WelcomeModalProps {
  open: boolean;
  onClose: (dontShowAgain?: boolean) => void;
  onGetStarted?: () => void;
}

/** Normalize YouTube / Vimeo URL to embed URL (no autoplay for user-controlled modal) */
function getVideoEmbedUrl(url: string): string {
  if (!url) return url;
  const ytShort = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  const ytWatch = url.match(/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/);
  const ytEmbed = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  const ytId = (ytShort || ytWatch || ytEmbed)?.[1];
  if (ytId) return `https://www.youtube.com/embed/${ytId}?rel=0`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

export default function WelcomeModal({ open, onClose, onGetStarted }: WelcomeModalProps) {
  const [dontShow, setDontShow] = useState(false);

  /* Lock body scroll while modal is open */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(dontShow); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, dontShow, onClose]);

  if (!open) return null;

  const videoUrl = WELCOME_VIDEO_URL;
  const lines = [WELCOME_LINE_1, WELCOME_LINE_2, WELCOME_LINE_3].filter(Boolean);
  const title = WELCOME_TITLE || `Welcome to ${APP_NAME || "Yantra"}`;

  return (
    <div
      className="welcome-overlay"
      onClick={() => onClose(dontShow)}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="welcome-modal" onClick={(e) => e.stopPropagation()}>

        {/* Close button */}
        <button
          className="welcome-close"
          onClick={() => onClose(dontShow)}
          aria-label="Close"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="welcome-header">
          <div className="welcome-icon-badge">
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="welcome-title">{title}</h2>
          <p className="welcome-tagline">Here&rsquo;s what you need to know</p>
        </div>

        {/* 3-liner text */}
        <div className="welcome-lines">
          {lines.map((line, i) => (
            <div key={i} className="welcome-line">
              <span className="welcome-line-num">{i + 1}</span>
              <p className="welcome-line-text">{line}</p>
            </div>
          ))}
        </div>

        {/* Video embed */}
        {videoUrl && (
          <div className="welcome-video-wrapper">
            <iframe
              src={getVideoEmbedUrl(videoUrl)}
              title="How it works"
              allow="fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
              className="welcome-video-iframe"
            />
          </div>
        )}

        {/* Footer actions */}
        <div className="welcome-footer">
          <label className="welcome-dont-show">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
            />
            <span>Don&rsquo;t show again</span>
          </label>
          <div className="welcome-action-btns">
            <button className="welcome-btn-close" onClick={() => onClose(dontShow)}>
              Close
            </button>
            {onGetStarted && (
              <button className="welcome-btn-start" onClick={onGetStarted}>
                Get Started
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
