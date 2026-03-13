"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [valid, setValid] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Validate invite code on load
  useEffect(() => {
    if (!code) {
      setValid(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/auth/validate-invite?code=${encodeURIComponent(code)}`);
        setValid(res.ok);
      } catch {
        setValid(false);
      }
    })();
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      router.push("/app");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (valid === null) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Checking invite...</h1>
        </div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Invalid Invite</h1>
          <div className="auth-error">This invite link is no longer valid.</div>
          <div className="auth-links">
            <a href="/request-access" className="auth-link">Request access instead</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Create Your Account</h1>
        <p className="auth-subtitle">You&apos;ve been invited! Set up your account below.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label className="auth-label">Name *</label>
          <input type="text" className="auth-input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />

          <label className="auth-label">Email *</label>
          <input type="email" className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label className="auth-label">Password *</label>
          <input type="password" className="auth-input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          <p className="auth-hint">Min 8 characters, at least one letter and one number</p>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="auth-links">
          <a href="/login" className="auth-link">Already have an account? Sign in</a>
        </div>
      </div>
    </div>
  );
}

