"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { APP_NAME, APP_LOGO } from "@/lib/branding";

interface Props {
  open: boolean;
  onClose: () => void;
  dailyUsed: number;
  dailyLimit: number;
  authDailyLimit: number;
}

export default function SignupGateModal({ open, onClose, dailyUsed, dailyLimit, authDailyLimit }: Props) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"prompt" | "checking" | "password" | "request" | "otp" | "loading">("prompt");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  async function handleCheckEmail() {
    if (!email.trim()) return;
    setStep("checking");
    setError("");
    try {
      await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const stepRes = await fetch("/api/auth/check-email/step");
      const data = await stepRes.json();
      setStep(data.step === "password" ? "password" : "request");
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("prompt");
    }
  }

  async function handleLogin() {
    setError("");
    setStep("loading");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        setError(data.error || "Login failed");
        setStep("password");
      }
    } catch {
      setError("Network error. Please try again.");
      setStep("password");
    }
  }

  async function handleRequestAccess() {
    if (!name.trim()) { setError("Name is required"); return; }
    setError("");
    setStep("loading");
    try {
      const res = await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), use_case: "Free tier access" }),
      });
      const data = await res.json();
      if (res.ok && data.requiresOTP) {
        setStep("otp");
      } else if (!res.ok) {
        setError(data.error || "Request failed");
        setStep("request");
      }
    } catch {
      setError("Network error. Please try again.");
      setStep("request");
    }
  }

  async function handleVerifyOTP() {
    if (otp.length !== 6) return;
    setError("");
    setStep("loading");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp }),
      });
      const data = await res.json();
      if (res.ok) {
        window.location.href = data.redirect || "/auth/set-password";
      } else {
        setError(data.error || "Invalid code");
        setStep("otp");
      }
    } catch {
      setError("Network error. Please try again.");
      setStep("otp");
    }
  }

  async function handleResendOTP() {
    setError("");
    try {
      await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), use_case: "Free tier access" }),
      });
      setOtp("");
    } catch {
      setError("Failed to resend code.");
    }
  }

  const inputStyle = { background: "var(--surface-secondary)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };
  const btnStyle = { background: "var(--color-primary)" };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md mx-0 sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--surface-primary)", border: "1px solid var(--border-emphasis)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center px-6 pt-6 pb-4 text-center" style={{ borderBottom: "1px solid var(--border-default)" }}>
          {APP_LOGO && (
            <Image src={APP_LOGO} alt={APP_NAME} width={48} height={48} className="rounded-xl mb-3" unoptimized />
          )}
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            You&apos;ve used {dailyUsed}/{dailyLimit} free requests today
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Sign up to unlock {authDailyLimit} daily requests &mdash; free.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {(step === "prompt" || step === "checking") && (
            <>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCheckEmail()}
                  placeholder="you@company.com"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                  autoFocus
                />
              </div>
              {error && <p className="text-xs" style={{ color: "var(--color-error, #ef4444)" }}>{error}</p>}
              <button
                onClick={handleCheckEmail}
                disabled={step === "checking" || !email.trim()}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={btnStyle}
              >
                {step === "checking" ? "Checking..." : "Continue"}
              </button>
            </>
          )}

          {(step === "password" || (step === "loading" && password && !otp)) && (
            <>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Signing in as <strong>{email}</strong></div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                  autoFocus
                />
              </div>
              {error && <p className="text-xs" style={{ color: "var(--color-error, #ef4444)" }}>{error}</p>}
              <button
                onClick={handleLogin}
                disabled={step === "loading"}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={btnStyle}
              >
                {step === "loading" ? "Signing in..." : "Sign In"}
              </button>
              <button
                onClick={() => { setStep("prompt"); setPassword(""); setError(""); }}
                className="w-full text-xs py-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Use a different email
              </button>
            </>
          )}

          {(step === "request" || (step === "loading" && !password && !otp)) && (
            <>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Creating account for <strong>{email}</strong></div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRequestAccess()}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                  autoFocus
                />
              </div>
              {error && <p className="text-xs" style={{ color: "var(--color-error, #ef4444)" }}>{error}</p>}
              <button
                onClick={handleRequestAccess}
                disabled={step === "loading"}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={btnStyle}
              >
                {step === "loading" ? "Sending code..." : "Continue"}
              </button>
              <button
                onClick={() => { setStep("prompt"); setName(""); setError(""); }}
                className="w-full text-xs py-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Use a different email
              </button>
            </>
          )}

          {(step === "otp" || (step === "loading" && otp)) && (
            <>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Enter the 6-digit code sent to <strong>{email}</strong>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Verification Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOTP()}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ ...inputStyle, letterSpacing: "0.3em", textAlign: "center", fontSize: "1.25rem" }}
                  autoFocus
                />
              </div>
              {error && <p className="text-xs" style={{ color: "var(--color-error, #ef4444)" }}>{error}</p>}
              <button
                onClick={handleVerifyOTP}
                disabled={step === "loading" || otp.length !== 6}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={btnStyle}
              >
                {step === "loading" ? "Verifying..." : "Verify"}
              </button>
              <div className="flex justify-between">
                <button
                  onClick={handleResendOTP}
                  className="text-xs py-1"
                  style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
                >
                  Resend code
                </button>
                <button
                  onClick={() => { setStep("request"); setOtp(""); setError(""); }}
                  className="text-xs py-1"
                  style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
                >
                  Change email
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
