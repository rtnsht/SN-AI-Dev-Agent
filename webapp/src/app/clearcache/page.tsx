"use client";

import { useEffect, useState } from "react";

/** Clear all cookies by setting each to expired (JS can only clear non-httpOnly cookies) */
function clearAllCookies(): void {
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const eq = cookie.indexOf("=");
    const name = eq > -1 ? cookie.substring(0, eq).trim() : cookie.trim();
    if (name) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  }
}

export default function ClearCachePage() {
  const [status, setStatus] = useState<"clearing" | "done">("clearing");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const run = async () => {
      try {
        // Clear server session cookie (httpOnly) via logout API
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      } catch {
        // Ignore; we still clear client state
      }
      sessionStorage.clear();
      localStorage.clear();
      clearAllCookies();
      setStatus("done");
      window.location.href = "/";
    };

    run();
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--surface-app)", color: "var(--text-primary)" }}
    >
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {status === "clearing" ? "Clearing cache…" : "Redirecting…"}
      </p>
    </div>
  );
}
