"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RequestAccessPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [useCase, setUseCase] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, use_case: useCase }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      if (data.requiresOTP) {
        setStep("otp");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid code");
        return;
      }

      router.push(data.redirect || "/auth/set-password");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError("");
    try {
      await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, use_case: useCase }),
      });
      setOtp("");
    } catch {
      setError("Failed to resend code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {step === "form" && (
          <>
            <h1 className="auth-title">Get Started</h1>
            <p className="auth-subtitle">Tell us a bit about yourself and we&apos;ll send you a verification code.</p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <label className="auth-label">Name *</label>
              <input
                type="text"
                className="auth-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />

              <label className="auth-label">Email *</label>
              <input
                type="email"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label className="auth-label">Company</label>
              <input
                type="text"
                className="auth-input"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />

              <label className="auth-label">What are you looking to build or solve?</label>
              <textarea
                className="auth-input"
                rows={3}
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                placeholder="e.g. Automate change approvals, build a custom portal, streamline incident workflows..."
              />

              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? "Sending code..." : "Continue"}
              </button>
            </form>
          </>
        )}

        {step === "otp" && (
          <>
            <h1 className="auth-title">Verify Your Email</h1>
            <p className="auth-subtitle">
              We sent a 6-digit code to <strong>{email}</strong>
            </p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleVerifyOTP}>
              <label className="auth-label">Verification Code</label>
              <input
                type="text"
                className="auth-input"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                required
                autoFocus
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                style={{ letterSpacing: "0.3em", textAlign: "center", fontSize: "1.25rem" }}
              />

              <button type="submit" className="auth-button" disabled={loading || otp.length !== 6}>
                {loading ? "Verifying..." : "Verify"}
              </button>
            </form>

            <div className="auth-links">
              <button
                onClick={handleResend}
                className="auth-link"
                disabled={resending}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                {resending ? "Resending..." : "Resend code"}
              </button>
              <button
                onClick={() => { setStep("form"); setOtp(""); setError(""); }}
                className="auth-link"
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                Change email
              </button>
            </div>
          </>
        )}

        <div className="auth-links">
          <a href="/login" className="auth-link">Already have access? Sign in</a>
        </div>
      </div>
    </div>
  );
}

