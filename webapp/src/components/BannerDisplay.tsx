"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";

interface BannerData {
  id: string;
  content_html: string;
  pages: string[];
  bg_color: string;
  text_color: string;
}

export default function BannerDisplay() {
  const pathname = usePathname();
  const [banners, setBanners] = useState<BannerData[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchBanners = useCallback(async () => {
    try {
      const res = await fetch("/api/banners");
      if (res.ok) {
        const data = await res.json();
        setBanners(data.banners || []);
      }
    } catch {
      // Silently fail — banners are non-critical
    }
  }, []);

  useEffect(() => {
    fetchBanners();
    // Refresh every 5 minutes to pick up changes
    const interval = setInterval(fetchBanners, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchBanners]);

  // Filter banners relevant to the current page
  const visibleBanners = banners.filter((b) => {
    if (dismissed.has(b.id)) return false;
    if (b.pages.includes("all")) return true;
    return b.pages.some((p) => pathname === p || pathname.startsWith(p + "/"));
  });

  if (visibleBanners.length === 0) return null;

  return (
    <div style={{ position: "relative", zIndex: 45 }}>
      {visibleBanners.map((banner) => (
        <div
          key={banner.id}
          style={{
            background: banner.bg_color,
            color: banner.text_color,
            padding: "8px 40px 8px 16px",
            fontSize: "13px",
            textAlign: "center",
            lineHeight: 1.5,
            position: "relative",
          }}
        >
          <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(banner.content_html || "", { ALLOWED_TAGS: ["b", "i", "u", "em", "strong", "a", "br", "p", "span"] }) }} />
          <button
            onClick={() => setDismissed((prev) => new Set(prev).add(banner.id))}
            aria-label="Dismiss banner"
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              opacity: 0.7,
              fontSize: "16px",
              padding: "2px 6px",
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
