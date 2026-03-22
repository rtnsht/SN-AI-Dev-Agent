"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import { Info, CheckCircle, AlertTriangle, XOctagon, X } from "lucide-react";

type BannerVariant = "info" | "success" | "warning" | "critical";

interface BannerData {
  id: string;
  content_html: string;
  pages: string[];
  variant?: BannerVariant;
  dismissible?: boolean;
  bg_color?: string;
  text_color?: string;
}

const VARIANT_ICON: Record<BannerVariant, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  critical: XOctagon,
};

const DISMISSED_KEY = "dismissed-banners";

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveDismissed(ids: Set<string>) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
}

function resolveVariant(banner: BannerData): BannerVariant {
  if (banner.variant && VARIANT_ICON[banner.variant]) return banner.variant;
  return "info";
}

export default function BannerDisplay() {
  const pathname = usePathname();
  const [banners, setBanners] = useState<BannerData[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => { setDismissed(loadDismissed()); }, []);

  const fetchBanners = useCallback(async () => {
    try {
      const res = await fetch("/api/banners");
      if (res.ok) {
        const data = await res.json();
        setBanners(data.banners || []);
      }
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    fetchBanners();
    const interval = setInterval(fetchBanners, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchBanners]);

  /** Cap at 2 stacked banners — more than two feels cluttered and pushes content down */
  const MAX_BANNERS = 2;

  const visibleBanners = banners
    .filter((b) => {
      if (b.dismissible !== false && dismissed.has(b.id)) return false;
      if (b.pages.includes("all")) return true;
      return b.pages.some((p) => pathname === p || pathname.startsWith(p + "/"));
    })
    .slice(0, MAX_BANNERS);

  if (visibleBanners.length === 0) return null;

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    saveDismissed(next);
  };

  return (
    <>
      {visibleBanners.map((banner) => {
        const variant = resolveVariant(banner);
        const Icon = VARIANT_ICON[variant];
        const canDismiss = banner.dismissible !== false;
        return (
          <div key={banner.id} className={`app-banner app-banner-${variant}${!canDismiss ? " app-banner-pinned" : ""}`}>
            <div className="app-banner-inner">
              <Icon size={16} className="app-banner-icon" />
              <span
                className="app-banner-text"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(banner.content_html || "", {
                    ALLOWED_TAGS: ["b", "i", "u", "em", "strong", "a", "br", "span"],
                  }),
                }}
              />
              {canDismiss && (
                <button
                  onClick={() => dismiss(banner.id)}
                  aria-label="Dismiss banner"
                  className="app-banner-dismiss"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
