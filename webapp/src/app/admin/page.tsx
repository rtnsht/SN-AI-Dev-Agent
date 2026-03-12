"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Tab = "requests" | "users" | "invites";

interface AccessRequest {
  id: string;
  email: string;
  name: string;
  company: string | null;
  use_case: string;
  status: string;
  email_verified: boolean;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  created_at: string;
  last_login: string | null;
}

interface InviteCode {
  id: string;
  code: string;
  label: string | null;
  max_uses: number | null;
  times_used: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("requests");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  // Invite creation form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteMaxUses, setInviteMaxUses] = useState("");
  const [inviteExpDays, setInviteExpDays] = useState("");

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "requests") {
        const res = await fetch("/api/admin/requests");
        if (res.status === 401 || res.status === 403) { router.push("/login"); return; }
        const data = await res.json();
        setRequests(data.requests || []);
      } else if (tab === "users") {
        const res = await fetch("/api/admin/users");
        if (res.status === 401 || res.status === 403) { router.push("/login"); return; }
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        const res = await fetch("/api/admin/invite-codes");
        if (res.status === 401 || res.status === 403) { router.push("/login"); return; }
        const data = await res.json();
        setInvites(data.inviteCodes || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [tab, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleRequestAction(id: string, action: "approve" | "reject") {
    setActionLoading(id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Request ${action}d successfully`);
        fetchData();
      } else {
        setMessage(data.error || "Action failed");
      }
    } catch { setMessage("Action failed"); }
    setActionLoading(null);
  }

  async function handleUserAction(id: string, action: "suspend" | "activate") {
    setActionLoading(id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`User ${action}d successfully`);
        fetchData();
      } else {
        setMessage(data.error || "Action failed");
      }
    } catch { setMessage("Action failed"); }
    setActionLoading(null);
  }

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading("create-invite");
    setMessage("");
    try {
      const res = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: inviteLabel || null,
          max_uses: inviteMaxUses ? parseInt(inviteMaxUses) : null,
          expires_in_days: inviteExpDays ? parseInt(inviteExpDays) : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Invite created: ${data.inviteUrl}`);
        navigator.clipboard.writeText(data.inviteUrl).catch(() => {});
        setShowInviteForm(false);
        setInviteLabel(""); setInviteMaxUses(""); setInviteExpDays("");
        fetchData();
      } else {
        setMessage(data.error || "Failed to create invite");
      }
    } catch { setMessage("Failed to create invite"); }
    setActionLoading(null);
  }

  async function handleRevokeInvite(id: string) {
    setActionLoading(id);
    try {
      await fetch(`/api/admin/invite-codes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      fetchData();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString() : "—";

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Admin Dashboard</h1>
        <a href="/" className="auth-link">← Back to app</a>
      </div>

      {message && <div className="auth-success" style={{ marginBottom: "1rem" }}>{message}</div>}

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === "requests" ? "active" : ""}`} onClick={() => setTab("requests")}>
          Requests {pendingCount > 0 && <span className="admin-badge">{pendingCount}</span>}
        </button>
        <button className={`admin-tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>Users</button>
        <button className={`admin-tab ${tab === "invites" ? "active" : ""}`} onClick={() => setTab("invites")}>Invite Codes</button>
      </div>

      {loading && <p className="admin-loading">Loading...</p>}

      {/* ── Requests Tab ── */}
      {tab === "requests" && !loading && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Company</th><th>Use Case</th><th>Status</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.email}</td>
                  <td>{r.company || "—"}</td>
                  <td className="admin-usecase">{r.use_case}</td>
                  <td><span className={`admin-status admin-status-${r.status}`}>{r.status}</span></td>
                  <td>{fmt(r.created_at)}</td>
                  <td>
                    {r.status === "pending" && (
                      <div className="admin-actions">
                        <button className="admin-btn admin-btn-approve" disabled={actionLoading === r.id} onClick={() => handleRequestAction(r.id, "approve")}>Approve</button>
                        <button className="admin-btn admin-btn-reject" disabled={actionLoading === r.id} onClick={() => handleRequestAction(r.id, "reject")}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && <tr><td colSpan={7} className="admin-empty">No requests</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Users Tab ── */}
      {tab === "users" && !loading && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td><span className={`admin-status admin-status-${u.status}`}>{u.status}</span></td>
                  <td>{fmt(u.last_login)}</td>
                  <td>{fmt(u.created_at)}</td>
                  <td>
                    {u.role !== "admin" && (
                      <button
                        className={`admin-btn ${u.status === "active" ? "admin-btn-reject" : "admin-btn-approve"}`}
                        disabled={actionLoading === u.id}
                        onClick={() => handleUserAction(u.id, u.status === "active" ? "suspend" : "activate")}
                      >
                        {u.status === "active" ? "Suspend" : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={7} className="admin-empty">No users</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Invite Codes Tab ── */}
      {tab === "invites" && !loading && (
        <>
          <button className="admin-btn admin-btn-approve" style={{ marginBottom: "1rem" }} onClick={() => setShowInviteForm(!showInviteForm)}>
            {showInviteForm ? "Cancel" : "+ Create Invite Code"}
          </button>

          {showInviteForm && (
            <form onSubmit={handleCreateInvite} className="admin-invite-form">
              <input className="auth-input" placeholder="Label (optional)" value={inviteLabel} onChange={(e) => setInviteLabel(e.target.value)} />
              <input className="auth-input" type="number" placeholder="Max uses (blank = unlimited)" value={inviteMaxUses} onChange={(e) => setInviteMaxUses(e.target.value)} />
              <input className="auth-input" type="number" placeholder="Expires in days (blank = never)" value={inviteExpDays} onChange={(e) => setInviteExpDays(e.target.value)} />
              <button type="submit" className="admin-btn admin-btn-approve" disabled={actionLoading === "create-invite"}>Create</button>
            </form>
          )}

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Code</th><th>Label</th><th>Uses</th><th>Expires</th><th>Active</th><th>Created</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id}>
                    <td className="admin-code">{inv.code}</td>
                    <td>{inv.label || "—"}</td>
                    <td>{inv.times_used}{inv.max_uses !== null ? `/${inv.max_uses}` : ""}</td>
                    <td>{inv.expires_at ? fmt(inv.expires_at) : "Never"}</td>
                    <td>{inv.is_active ? "Yes" : "No"}</td>
                    <td>{fmt(inv.created_at)}</td>
                    <td>
                      <div className="admin-actions">
                        <button className="admin-btn" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.code}`); setMessage("Link copied!"); }}>Copy</button>
                        {inv.is_active && (
                          <button className="admin-btn admin-btn-reject" disabled={actionLoading === inv.id} onClick={() => handleRevokeInvite(inv.id)}>Revoke</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {invites.length === 0 && <tr><td colSpan={7} className="admin-empty">No invite codes</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

