"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type ModalStep =
  | "email"
  | "checking"
  | "password"
  | "login_loading"
  | "request_access"
  | "request_loading"
  | "otp_verify"
  | "otp_loading"
  | "forgot_password"
  | "forgot_loading"
  | "forgot_success";

interface ConnectModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ConnectModal({ open, onClose }: ConnectModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<ModalStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [useCase, setUseCase] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");

  const resetState = useCallback(() => {
    setStep("email");
    setEmail("");
    setPassword("");
    setName("");
    setCompany("");
    setUseCase("");
    setOtp("");
    setError("");
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  /** Step 1: Check email */
  const handleEmailSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setStep("checking");

    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setStep("email");
        return;
      }

      // Now fetch the hint (cookie was set by the POST)
      const stepRes = await fetch("/api/auth/check-email/step");
      if (!stepRes.ok) {
        setError("We could not verify your email flow. Please try again.");
        setStep("email");
        return;
      }
      const stepData = await stepRes.json();

      if (stepData.step === "password") {
        setStep("password");
      } else {
        setStep("request_access");
      }
    } catch {
      setError("Network error. Please try again.");
      setStep("email");
    }
  }, [email]);

  /** Step 2a: Login */
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setError("");
    setStep("login_loading");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setStep("password");
        return;
      }

      if (data.mustSetPassword) {
        handleClose();
        router.push("/auth/set-password");
        return;
      }

      handleClose();
      router.push("/app");
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("password");
    }
  }, [email, password, router, handleClose]);

  /** Step 2b: Request Access — sends OTP */
  const handleRequestAccess = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    setStep("request_loading");

    try {
      const res = await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim(),
          company: company.trim(),
          use_case: useCase.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setStep("request_access");
        return;
      }

      if (data.requiresOTP) {
        setStep("otp_verify");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("request_access");
    }
  }, [email, name, company, useCase]);

  /** Step 2c: Verify OTP */
  const handleVerifyOTP = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setError("");
    setStep("otp_loading");

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid code");
        setStep("otp_verify");
        return;
      }

      router.push(data.redirect || "/auth/set-password");
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("otp_verify");
    }
  }, [email, otp, router]);

  /** Resend OTP */
  const handleResendOTP = useCallback(async () => {
    setError("");
    try {
      await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim(),
          company: company.trim(),
          use_case: useCase.trim(),
        }),
      });
      setOtp("");
    } catch {
      setError("Failed to resend code.");
    }
  }, [email, name, company, useCase]);

  /** Forgot Password */
  const handleForgotPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStep("forgot_loading");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setStep("forgot_password");
        return;
      }

      setStep("forgot_success");
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("forgot_password");
    }
  }, [email]);

  if (!open) return null;

  const isLoading = step === "checking" || step === "login_loading" || step === "request_loading" || step === "otp_loading" || step === "forgot_loading";

  return (
    <div className="connect-modal-backdrop" onClick={handleClose}>
      <div className="connect-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button onClick={handleClose} className="connect-modal-close" aria-label="Close">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* ── Step: Email Input ── */}
        {(step === "email" || step === "checking") && (
          <form onSubmit={handleEmailSubmit}>
            <h2 className="connect-modal-title">Get Started</h2>
            <p className="connect-modal-subtitle">Enter your email to continue</p>
            {error && <div className="auth-error">{error}</div>}
            <label className="auth-label">Email</label>
            <input
              type="email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
              disabled={isLoading}
            />
            <button type="submit" className="auth-button" disabled={isLoading}>
              {step === "checking" ? "Checking..." : "Continue"}
            </button>
          </form>
        )}

        {/* ── Step: Password (returning user) ── */}
        {(step === "password" || step === "login_loading") && (
          <form onSubmit={handleLogin}>
            <h2 className="connect-modal-title">Welcome back</h2>
            <p className="connect-modal-subtitle">{email}</p>
            {error && <div className="auth-error">{error}</div>}
            <label className="auth-label">Password</label>
            <input
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              disabled={isLoading}
            />
            <button type="submit" className="auth-button" disabled={isLoading}>
              {step === "login_loading" ? "Signing in..." : "Sign In"}
            </button>
            <div className="connect-modal-links">
              <button type="button" onClick={() => { setError(""); setStep("forgot_password"); }} className="auth-link">
                Forgot password?
              </button>
              <button type="button" onClick={() => { setError(""); setStep("email"); setPassword(""); }} className="auth-link">
                &larr; Back
              </button>
            </div>
          </form>
        )}

        {/* ── Step: Request Access (new user) ── */}
        {(step === "request_access" || step === "request_loading") && (
          <form onSubmit={handleRequestAccess}>
            <h2 className="connect-modal-title">Create Account</h2>
            <p className="connect-modal-subtitle">We&apos;ll send a verification code to your email</p>
            {error && <div className="auth-error">{error}</div>}
            <label className="auth-label">Email</label>
            <input type="email" className="auth-input" value={email} disabled />
            <label className="auth-label">Name</label>
            <input
              type="text"
              className="auth-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              autoFocus
              disabled={isLoading}
            />
            <label className="auth-label">Company <span style={{ color: "var(--text-disabled)" }}>(optional)</span></label>
            <input
              type="text"
              className="auth-input"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Your company"
              disabled={isLoading}
            />
            <label className="auth-label">What will you build? <span style={{ color: "var(--text-disabled)" }}>(optional)</span></label>
            <textarea
              className="auth-input"
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              placeholder="Briefly describe your use case"
              rows={3}
              disabled={isLoading}
              style={{ resize: "none" }}
            />
            <button type="submit" className="auth-button" disabled={isLoading}>
              {step === "request_loading" ? "Sending code..." : "Continue"}
            </button>
            <div className="connect-modal-links">
              <button type="button" onClick={() => { setError(""); setStep("email"); }} className="auth-link">
                &larr; Back
              </button>
            </div>
          </form>
        )}

        {/* ── Step: OTP Verification ── */}
        {(step === "otp_verify" || step === "otp_loading") && (
          <form onSubmit={handleVerifyOTP}>
            <h2 className="connect-modal-title">Verify Your Email</h2>
            <p className="connect-modal-subtitle">
              Enter the 6-digit code sent to <strong>{email}</strong>
            </p>
            {error && <div className="auth-error">{error}</div>}
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
              disabled={isLoading}
              style={{ letterSpacing: "0.3em", textAlign: "center", fontSize: "1.25rem" }}
            />
            <button type="submit" className="auth-button" disabled={isLoading || otp.length !== 6}>
              {step === "otp_loading" ? "Verifying..." : "Verify"}
            </button>
            <div className="connect-modal-links">
              <button type="button" onClick={handleResendOTP} className="auth-link">
                Resend code
              </button>
              <button type="button" onClick={() => { setError(""); setOtp(""); setStep("request_access"); }} className="auth-link">
                &larr; Back
              </button>
            </div>
          </form>
        )}

        {/* ── Step: Forgot Password ── */}
        {(step === "forgot_password" || step === "forgot_loading") && (
          <form onSubmit={handleForgotPassword}>
            <h2 className="connect-modal-title">Reset Password</h2>
            <p className="connect-modal-subtitle">We&apos;ll send a reset link to your email</p>
            {error && <div className="auth-error">{error}</div>}
            <label className="auth-label">Email</label>
            <input type="email" className="auth-input" value={email} disabled />
            <button type="submit" className="auth-button" disabled={isLoading}>
              {step === "forgot_loading" ? "Sending..." : "Send Reset Link"}
            </button>
            <div className="connect-modal-links">
              <button type="button" onClick={() => { setError(""); setStep("password"); }} className="auth-link">
                &larr; Back to sign in
              </button>
            </div>
          </form>
        )}

        {/* ── Step: Forgot Success ── */}
        {step === "forgot_success" && (
          <div>
            <h2 className="connect-modal-title">Check Your Email</h2>
            <p className="connect-modal-subtitle">
              If an account exists for <strong>{email}</strong>, you&apos;ll receive a password reset link shortly.
            </p>
            <button onClick={handleClose} className="auth-button">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
