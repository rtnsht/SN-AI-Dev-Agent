"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EmergencyLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/emergency-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Emergency login failed");
        return;
      }

      router.push(data.redirect || "/auth/set-password");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Emergency Login</h1>
        <p className="auth-subtitle">
          Use the recovery token to create a temporary admin session, then set a new password.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label className="auth-label">Recovery Token</label>
          <input
            type="password"
            className="auth-input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            autoFocus
            autoComplete="one-time-code"
          />

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? "Verifying token..." : "Continue"}
          </button>
        </form>

        <div className="auth-links">
          <a href="/login" className="auth-link">Back to sign in</a>
        </div>
      </div>
    </div>
  );
}
