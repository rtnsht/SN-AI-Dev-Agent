"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

type Tab = "requests" | "users" | "invites" | "banners";

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

interface Banner {
  id: string;
  title: string;
  content_html: string;
  pages: string[];
  bg_color: string;
  text_color: string;
  is_active: boolean;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
}

const PAGE_OPTIONS = [
  { value: "all", label: "All Pages" },
  { value: "/", label: "Landing Page (/)" },
  { value: "/app", label: "App (/app)" },
  { value: "/admin", label: "Admin (/admin)" },
  { value: "/login", label: "Login (/login)" },
  { value: "/request-access", label: "Request Access" },
];

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("requests");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  // Invite creation form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteMaxUses, setInviteMaxUses] = useState("");
  const [inviteExpDays, setInviteExpDays] = useState("");

  // Banner creation/edit form
  const [showBannerForm, setShowBannerForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerBgColor, setBannerBgColor] = useState("#1e40af");
  const [bannerTextColor, setBannerTextColor] = useState("#ffffff");
  const [bannerPages, setBannerPages] = useState<string[]>(["all"]);
  const [bannerStartAt, setBannerStartAt] = useState("");
  const [bannerEndAt, setBannerEndAt] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

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
      } else if (tab === "banners") {
        const res = await fetch("/api/admin/banners");
        if (res.status === 401 || res.status === 403) { router.push("/login"); return; }
        const data = await res.json();
        setBanners(data.banners || []);
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

  // ── Banner actions ──

  function resetBannerForm() {
    setBannerTitle("");
    setBannerBgColor("#1e40af");
    setBannerTextColor("#ffffff");
    setBannerPages(["all"]);
    setBannerStartAt("");
    setBannerEndAt("");
    setEditingBanner(null);
    setShowBannerForm(false);
  }

  function openBannerEditor(banner?: Banner) {
    if (banner) {
      setEditingBanner(banner);
      setBannerTitle(banner.title);
      setBannerBgColor(banner.bg_color);
      setBannerTextColor(banner.text_color);
      setBannerPages(banner.pages);
      setBannerStartAt(banner.start_at ? banner.start_at.slice(0, 16) : "");
      setBannerEndAt(banner.end_at ? banner.end_at.slice(0, 16) : "");
      // Set editor HTML after DOM renders
      setTimeout(() => {
        if (editorRef.current) editorRef.current.innerHTML = banner.content_html;
      }, 50);
    } else {
      resetBannerForm();
      setTimeout(() => {
        if (editorRef.current) editorRef.current.innerHTML = "";
      }, 50);
    }
    setShowBannerForm(true);
  }

  function execCmd(command: string, value?: string) {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }

  function handleHighlightColor(color: string) {
    document.execCommand("hiliteColor", false, color);
    editorRef.current?.focus();
  }

  function handleFontColor(color: string) {
    document.execCommand("foreColor", false, color);
    editorRef.current?.focus();
  }

  function togglePage(page: string) {
    if (page === "all") {
      setBannerPages(["all"]);
      return;
    }
    setBannerPages((prev) => {
      const without = prev.filter((p) => p !== "all" && p !== page);
      if (prev.includes(page)) {
        return without.length === 0 ? ["all"] : without;
      }
      return [...without, page];
    });
  }

  async function handleSaveBanner(e: React.FormEvent) {
    e.preventDefault();
    const contentHtml = editorRef.current?.innerHTML || "";
    if (!bannerTitle.trim()) { setMessage("Banner title is required"); return; }
    if (!contentHtml.trim()) { setMessage("Banner content is required"); return; }

    setActionLoading("save-banner");
    setMessage("");
    try {
      const payload = {
        title: bannerTitle.trim(),
        content_html: contentHtml,
        pages: bannerPages,
        bg_color: bannerBgColor,
        text_color: bannerTextColor,
        start_at: bannerStartAt ? new Date(bannerStartAt).toISOString() : null,
        end_at: bannerEndAt ? new Date(bannerEndAt).toISOString() : null,
      };

      let res: Response;
      if (editingBanner) {
        res = await fetch(`/api/admin/banners/${editingBanner.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/admin/banners", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        setMessage(editingBanner ? "Banner updated" : "Banner created");
        resetBannerForm();
        fetchData();
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to save banner");
      }
    } catch { setMessage("Failed to save banner"); }
    setActionLoading(null);
  }

  async function handleToggleBanner(id: string) {
    setActionLoading(id);
    try {
      await fetch(`/api/admin/banners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle" }),
      });
      fetchData();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  async function handleDeleteBanner(id: string) {
    if (!confirm("Delete this banner?")) return;
    setActionLoading(id);
    try {
      await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
      fetchData();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString() : "—";

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Admin Dashboard</h1>
        <a href="/" className="auth-link">&larr; Back to app</a>
      </div>

      {message && <div className="auth-success" style={{ marginBottom: "1rem" }}>{message}</div>}

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === "requests" ? "active" : ""}`} onClick={() => setTab("requests")}>
          Requests {pendingCount > 0 && <span className="admin-badge">{pendingCount}</span>}
        </button>
        <button className={`admin-tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>Users</button>
        <button className={`admin-tab ${tab === "invites" ? "active" : ""}`} onClick={() => setTab("invites")}>Invite Codes</button>
        <button className={`admin-tab ${tab === "banners" ? "active" : ""}`} onClick={() => setTab("banners")}>Banners</button>
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

      {/* ── Banners Tab ── */}
      {tab === "banners" && !loading && (
        <>
          <button
            className="admin-btn admin-btn-approve"
            style={{ marginBottom: "1rem" }}
            onClick={() => showBannerForm ? resetBannerForm() : openBannerEditor()}
          >
            {showBannerForm ? "Cancel" : "+ Create Banner"}
          </button>

          {showBannerForm && (
            <form onSubmit={handleSaveBanner} style={{
              background: "var(--surface-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "1.5rem",
            }}>
              <h3 style={{ color: "var(--text-primary)", fontSize: "15px", fontWeight: 600, margin: "0 0 16px" }}>
                {editingBanner ? "Edit Banner" : "Create Banner"}
              </h3>

              {/* Title */}
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
                  Title (internal label)
                </label>
                <input
                  className="auth-input"
                  value={bannerTitle}
                  onChange={(e) => setBannerTitle(e.target.value)}
                  placeholder="e.g. Maintenance Notice"
                  required
                />
              </div>

              {/* Rich Content Editor */}
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
                  Banner Content (rich text)
                </label>
                {/* Toolbar */}
                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "2px",
                  padding: "6px 8px",
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--border-default)",
                  borderBottom: "none",
                  borderRadius: "8px 8px 0 0",
                }}>
                  <button type="button" onClick={() => execCmd("bold")} title="Bold" style={toolbarBtnStyle}><b>B</b></button>
                  <button type="button" onClick={() => execCmd("italic")} title="Italic" style={toolbarBtnStyle}><i>I</i></button>
                  <button type="button" onClick={() => execCmd("underline")} title="Underline" style={toolbarBtnStyle}><u>U</u></button>
                  <button type="button" onClick={() => execCmd("strikeThrough")} title="Strikethrough" style={toolbarBtnStyle}><s>S</s></button>
                  <span style={{ width: "1px", background: "var(--border-default)", margin: "0 4px" }} />
                  {/* Font color */}
                  <label title="Text Color" style={{ ...toolbarBtnStyle, position: "relative", cursor: "pointer" }}>
                    A<span style={{ display: "block", height: "3px", background: "var(--color-danger)", borderRadius: "1px", marginTop: "1px" }} />
                    <input type="color" onChange={(e) => handleFontColor(e.target.value)} style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", top: 0, left: 0, cursor: "pointer" }} />
                  </label>
                  {/* Highlight color */}
                  <label title="Highlight Color" style={{ ...toolbarBtnStyle, position: "relative", cursor: "pointer" }}>
                    <span style={{ background: "#fde047", padding: "0 3px", borderRadius: "2px", fontSize: "11px" }}>H</span>
                    <input type="color" defaultValue="#fde047" onChange={(e) => handleHighlightColor(e.target.value)} style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", top: 0, left: 0, cursor: "pointer" }} />
                  </label>
                  <span style={{ width: "1px", background: "var(--border-default)", margin: "0 4px" }} />
                  <button type="button" onClick={() => execCmd("justifyLeft")} title="Align Left" style={toolbarBtnStyle}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                  </button>
                  <button type="button" onClick={() => execCmd("justifyCenter")} title="Align Center" style={toolbarBtnStyle}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
                  </button>
                  <button type="button" onClick={() => execCmd("removeFormat")} title="Clear Formatting" style={toolbarBtnStyle}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                {/* Editable area */}
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  style={{
                    minHeight: "80px",
                    padding: "10px 12px",
                    border: "1px solid var(--border-default)",
                    borderRadius: "0 0 8px 8px",
                    background: "var(--surface-primary)",
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    outline: "none",
                    lineHeight: 1.5,
                  }}
                />
              </div>

              {/* Color pickers row */}
              <div style={{ display: "flex", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
                <div>
                  <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
                    Background Color
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="color" value={bannerBgColor} onChange={(e) => setBannerBgColor(e.target.value)} style={{ width: "36px", height: "30px", border: "none", cursor: "pointer", borderRadius: "4px" }} />
                    <input className="auth-input" value={bannerBgColor} onChange={(e) => setBannerBgColor(e.target.value)} style={{ width: "90px", fontSize: "12px" }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
                    Text Color
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="color" value={bannerTextColor} onChange={(e) => setBannerTextColor(e.target.value)} style={{ width: "36px", height: "30px", border: "none", cursor: "pointer", borderRadius: "4px" }} />
                    <input className="auth-input" value={bannerTextColor} onChange={(e) => setBannerTextColor(e.target.value)} style={{ width: "90px", fontSize: "12px" }} />
                  </div>
                </div>
              </div>

              {/* Live preview */}
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
                  Preview
                </label>
                <div
                  style={{
                    background: bannerBgColor,
                    color: bannerTextColor,
                    padding: "10px 16px",
                    borderRadius: "8px",
                    fontSize: "14px",
                    textAlign: "center",
                    lineHeight: 1.5,
                  }}
                  dangerouslySetInnerHTML={{ __html: editorRef.current?.innerHTML || "<em>Start typing content above...</em>" }}
                />
              </div>

              {/* Target pages */}
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "6px" }}>
                  Show on Pages
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {PAGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => togglePage(opt.value)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 500,
                        cursor: "pointer",
                        border: "1px solid",
                        transition: "all 150ms ease",
                        background: bannerPages.includes(opt.value) ? "var(--color-primary)" : "var(--surface-elevated)",
                        color: bannerPages.includes(opt.value) ? "#fff" : "var(--text-secondary)",
                        borderColor: bannerPages.includes(opt.value) ? "var(--color-primary)" : "var(--border-default)",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              <div style={{ display: "flex", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
                <div>
                  <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
                    Start At (optional)
                  </label>
                  <input
                    className="auth-input"
                    type="datetime-local"
                    value={bannerStartAt}
                    onChange={(e) => setBannerStartAt(e.target.value)}
                    style={{ fontSize: "12px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
                    End At (optional)
                  </label>
                  <input
                    className="auth-input"
                    type="datetime-local"
                    value={bannerEndAt}
                    onChange={(e) => setBannerEndAt(e.target.value)}
                    style={{ fontSize: "12px" }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="admin-btn admin-btn-approve"
                disabled={actionLoading === "save-banner"}
              >
                {actionLoading === "save-banner" ? "Saving..." : (editingBanner ? "Update Banner" : "Create Banner")}
              </button>
            </form>
          )}

          {/* Banner list */}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Title</th><th>Preview</th><th>Pages</th><th>Schedule</th><th>Active</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {banners.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 500 }}>{b.title}</td>
                    <td>
                      <div
                        style={{
                          background: b.bg_color,
                          color: b.text_color,
                          padding: "4px 10px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          maxWidth: "220px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        dangerouslySetInnerHTML={{ __html: b.content_html }}
                      />
                    </td>
                    <td style={{ fontSize: "11px" }}>{b.pages.join(", ")}</td>
                    <td style={{ fontSize: "11px" }}>
                      {b.start_at || b.end_at
                        ? `${b.start_at ? fmt(b.start_at) : "now"} → ${b.end_at ? fmt(b.end_at) : "forever"}`
                        : "Always"}
                    </td>
                    <td>
                      <span className={`admin-status ${b.is_active ? "admin-status-active" : "admin-status-suspended"}`}>
                        {b.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button className="admin-btn" disabled={actionLoading === b.id} onClick={() => openBannerEditor(b)}>Edit</button>
                        <button
                          className={`admin-btn ${b.is_active ? "admin-btn-reject" : "admin-btn-approve"}`}
                          disabled={actionLoading === b.id}
                          onClick={() => handleToggleBanner(b.id)}
                        >
                          {b.is_active ? "Disable" : "Enable"}
                        </button>
                        <button className="admin-btn admin-btn-reject" disabled={actionLoading === b.id} onClick={() => handleDeleteBanner(b.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {banners.length === 0 && <tr><td colSpan={6} className="admin-empty">No banners</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const toolbarBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid transparent",
  borderRadius: "4px",
  color: "var(--text-secondary)",
  cursor: "pointer",
  padding: "4px 8px",
  fontSize: "13px",
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "28px",
  height: "28px",
  transition: "all 100ms ease",
};
