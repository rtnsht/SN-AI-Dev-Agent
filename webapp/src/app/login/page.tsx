"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      router.push(redirect);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setForgotMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setForgotMessage(data.message);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{forgotMode ? "Reset Password" : "Sign In"}</h1>
        <p className="auth-subtitle">
          {forgotMode
            ? "Enter your email to receive a reset link."
            : "Enter your credentials to continue."}
        </p>

        {error && <div className="auth-error">{error}</div>}
        {forgotMessage && <div className="auth-success">{forgotMessage}</div>}

        <form onSubmit={forgotMode ? handleForgotPassword : handleLogin}>
          <label className="auth-label">Email</label>
          <input
            type="email"
            className="auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />

          {!forgotMode && (
            <>
              <label className="auth-label">Password</label>
              <input
                type="password"
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </>
          )}

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? "Please wait..." : forgotMode ? "Send Reset Link" : "Sign In"}
          </button>
        </form>

        <div className="auth-links">
          <button
            className="auth-link"
            onClick={() => { setForgotMode(!forgotMode); setError(""); setForgotMessage(""); }}
          >
            {forgotMode ? "Back to sign in" : "Forgot password?"}
          </button>
          <a href="/request-access" className="auth-link">Request access</a>
        </div>
      </div>
    </div>
  );
}

