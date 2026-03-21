"use client";

/**
 * Site-wide banner + feedback entry points so non-/app routes still show announcements
 * and can open feedback (app page keeps header-triggered feedback).
 */
import { usePathname } from "next/navigation";
import BannerDisplay from "@/components/BannerDisplay";
import FeedbackFAB from "@/components/FeedbackFAB";

export default function GlobalChrome() {
  const pathname = usePathname() || "";
  const isApp = pathname.startsWith("/app");

  return (
    <>
      <BannerDisplay />
      {!isApp && <FeedbackFAB />}
    </>
  );
}
