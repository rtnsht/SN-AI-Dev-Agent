"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Invalid link — no token provided.");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/auth/verify-magic-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setError(data.error || "Invalid or expired link");
          return;
        }

        // Redirect based on response
        router.push(data.redirect || "/");
      } catch {
        setStatus("error");
        setError("Something went wrong. Please try again.");
      }
    })();
  }, [token, router]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        {status === "loading" && (
          <>
            <h1 className="auth-title">Verifying...</h1>
            <p className="auth-subtitle">Please wait while we verify your link.</p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="auth-title">Link Invalid</h1>
            <div className="auth-error">{error}</div>
            <div className="auth-links">
              <a href="/login" className="auth-link">Go to sign in</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Loading...</h1>
        </div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}

