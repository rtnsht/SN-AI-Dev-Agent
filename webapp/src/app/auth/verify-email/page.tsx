"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid link — no token provided.");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setMessage(data.error || "Invalid or expired link");
          return;
        }

        setStatus("success");
        setMessage(data.message || "Email verified!");
      } catch {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    })();
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        {status === "loading" && (
          <>
            <h1 className="auth-title">Verifying Email...</h1>
            <p className="auth-subtitle">Please wait.</p>
          </>
        )}
        {status === "success" && (
          <>
            <h1 className="auth-title">Email Verified</h1>
            <div className="auth-success">{message}</div>
            <div className="auth-links">
              <a href="/login" className="auth-link">Go to sign in</a>
            </div>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="auth-title">Verification Failed</h1>
            <div className="auth-error">{message}</div>
            <div className="auth-links">
              <a href="/request-access" className="auth-link">Request access again</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

