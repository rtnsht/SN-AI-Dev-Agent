"use client";

import { useState, useCallback, useEffect, useRef } from "react";

type FeedbackType = "feedback" | "bug_report";
type FormStatus = "idle" | "submitting" | "success" | "error";

const ACCEPTED_EXTENSIONS = ".png,.pdf,.doc,.docx,.xls,.xlsx";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_MIME_TYPES = new Set([
  "image/png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FeedbackFAB({ hideButton = false, externalOpen = false, onExternalClose }: { hideButton?: boolean; externalOpen?: boolean; onExternalClose?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (externalOpen) setIsOpen(true);
  }, [externalOpen]);
  const [type, setType] = useState<FeedbackType>("feedback");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Hide FAB when mobile virtual keyboard is open
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const threshold = 0.75; // keyboard considered open when viewport shrinks below 75% of window height
    const onResize = () => {
      setKeyboardOpen(vv.height < window.innerHeight * threshold);
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const resetForm = useCallback(() => {
    setType("feedback");
    setDescription("");
    setEmail("");
    setFiles([]);
    setStatus("idle");
    setErrorMessage("");
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    onExternalClose?.();
    if (status === "success") resetForm();
  }, [status, resetForm, onExternalClose]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, handleClose]);

  // Auto-close after success
  useEffect(() => {
    if (status !== "success") return;
    const timer = setTimeout(() => {
      setIsOpen(false);
      resetForm();
    }, 3000);
    return () => clearTimeout(timer);
  }, [status, resetForm]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    for (const file of Array.from(selected)) {
      if (!ACCEPTED_MIME_TYPES.has(file.type)) {
        setErrorMessage(
          `File type not allowed: ${file.name}. Accepted: PNG, PDF, DOC, DOCX, XLS, XLSX.`
        );
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setErrorMessage(`File '${file.name}' exceeds the 10MB size limit.`);
        return;
      }
    }

    setErrorMessage("");
    setFiles((prev) => [...prev, ...Array.from(selected)]);
    // Reset input so same file can be re-added after removal
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!description.trim()) {
      setErrorMessage("Description is required.");
      return;
    }

    setStatus("submitting");

    try {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("description", description.trim());
      if (email.trim()) formData.append("email", email.trim());
      formData.append("page_url", window.location.href);
      formData.append("user_agent", navigator.userAgent);
      for (const file of files) {
        formData.append("attachments", file);
      }

      const res = await fetch("/api/feedback", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Something went wrong.");
        setStatus("error");
        return;
      }

      setStatus("success");
    } catch {
      setErrorMessage("Network error. Please try again.");
      setStatus("error");
    }
  };

  const placeholderText =
    type === "feedback"
      ? "Tell us what you think or suggest an improvement..."
      : "Describe the issue. What happened and what did you expect?";

  return (
    <>
      {/* Floating Action Button — hidden when mobile keyboard is open or when hideButton is set */}
      {!isOpen && !keyboardOpen && !hideButton && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Send feedback"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "var(--color-primary)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            zIndex: 40,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            transition: "transform 150ms ease, box-shadow 150ms ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.transform = "scale(1)";
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Modal */}
      {isOpen && (
        <div
          onClick={handleClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            animation: "fadeIn 200ms ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: "16px",
              padding: "28px",
              width: "100%",
              maxWidth: "480px",
              maxHeight: "85vh",
              overflowY: "auto",
              animation: "slideUp 250ms ease",
              position: "relative",
            }}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              aria-label="Close"
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                padding: "4px",
                lineHeight: 1,
                fontSize: "20px",
              }}
            >
              &times;
            </button>

            {/* Success state */}
            {status === "success" ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 0",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "var(--color-success)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3
                  style={{
                    color: "var(--text-primary)",
                    fontSize: "18px",
                    fontWeight: 600,
                    margin: "0 0 8px",
                  }}
                >
                  Thank you!
                </h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "14px",
                    margin: 0,
                  }}
                >
                  Your feedback has been received.
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <h2
                  style={{
                    color: "var(--text-primary)",
                    fontSize: "18px",
                    fontWeight: 600,
                    margin: "0 0 20px",
                  }}
                >
                  Send Feedback
                </h2>

                <form onSubmit={handleSubmit}>
                  {/* Type toggle */}
                  <div style={{ marginBottom: "16px" }}>
                    <label
                      style={{
                        display: "block",
                        color: "var(--text-secondary)",
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "8px",
                      }}
                    >
                      Type
                    </label>
                    <div
                      style={{
                        display: "flex",
                        gap: "0",
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setType("feedback")}
                        style={{
                          flex: 1,
                          padding: "10px 16px",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: 500,
                          transition: "all 150ms ease",
                          background:
                            type === "feedback"
                              ? "var(--color-primary)"
                              : "var(--surface-secondary)",
                          color:
                            type === "feedback"
                              ? "#fff"
                              : "var(--text-secondary)",
                        }}
                      >
                        Feedback
                      </button>
                      <button
                        type="button"
                        onClick={() => setType("bug_report")}
                        style={{
                          flex: 1,
                          padding: "10px 16px",
                          border: "none",
                          borderLeft: "1px solid var(--border-default)",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: 500,
                          transition: "all 150ms ease",
                          background:
                            type === "bug_report"
                              ? "var(--color-primary)"
                              : "var(--surface-secondary)",
                          color:
                            type === "bug_report"
                              ? "#fff"
                              : "var(--text-secondary)",
                        }}
                      >
                        Bug Report
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <div style={{ marginBottom: "16px" }}>
                    <label
                      style={{
                        display: "block",
                        color: "var(--text-secondary)",
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "8px",
                      }}
                    >
                      Description <span style={{ color: "var(--color-danger)" }}>*</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={placeholderText}
                      required
                      rows={4}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border-emphasis)",
                        background: "var(--surface-secondary)",
                        color: "var(--text-primary)",
                        fontSize: "14px",
                        resize: "vertical",
                        minHeight: "100px",
                        fontFamily: "inherit",
                        outline: "none",
                        transition: "border-color 150ms ease",
                        boxSizing: "border-box",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor =
                          "var(--color-primary)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor =
                          "var(--border-emphasis)";
                      }}
                    />
                  </div>

                  {/* Email */}
                  <div style={{ marginBottom: "16px" }}>
                    <label
                      style={{
                        display: "block",
                        color: "var(--text-secondary)",
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "8px",
                      }}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border-emphasis)",
                        background: "var(--surface-secondary)",
                        color: "var(--text-primary)",
                        fontSize: "14px",
                        outline: "none",
                        transition: "border-color 150ms ease",
                        boxSizing: "border-box",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor =
                          "var(--color-primary)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor =
                          "var(--border-emphasis)";
                      }}
                    />
                    <p
                      style={{
                        color: "var(--text-disabled)",
                        fontSize: "12px",
                        margin: "6px 0 0",
                      }}
                    >
                      Optional — only used if we need to follow up with you.
                    </p>
                  </div>

                  {/* File upload */}
                  <div style={{ marginBottom: "20px" }}>
                    <label
                      style={{
                        display: "block",
                        color: "var(--text-secondary)",
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "8px",
                      }}
                    >
                      Attachment
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: "2px dashed var(--border-default)",
                        borderRadius: "8px",
                        padding: "16px",
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "border-color 150ms ease",
                        background: "var(--surface-secondary)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor =
                          "var(--color-primary)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor =
                          "var(--border-default)";
                      }}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--text-disabled)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ margin: "0 auto 8px", display: "block" }}
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <p
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "13px",
                          margin: "0 0 4px",
                        }}
                      >
                        Click to upload a file
                      </p>
                      <p
                        style={{
                          color: "var(--text-disabled)",
                          fontSize: "11px",
                          margin: 0,
                        }}
                      >
                        PNG, PDF, DOC, DOCX, XLS, XLSX — Max 10MB
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_EXTENSIONS}
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                      multiple
                    />

                    {/* File list */}
                    {files.length > 0 && (
                      <div style={{ marginTop: "8px" }}>
                        {files.map((file, i) => (
                          <div
                            key={`${file.name}-${i}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 10px",
                              borderRadius: "6px",
                              background: "var(--surface-elevated)",
                              marginTop: i > 0 ? "4px" : "0",
                              fontSize: "13px",
                            }}
                          >
                            <span
                              style={{
                                color: "var(--text-primary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                                marginRight: "8px",
                              }}
                            >
                              {file.name}{" "}
                              <span
                                style={{
                                  color: "var(--text-disabled)",
                                  fontSize: "12px",
                                }}
                              >
                                ({formatFileSize(file.size)})
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFile(i)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "var(--text-secondary)",
                                cursor: "pointer",
                                padding: "2px 6px",
                                fontSize: "16px",
                                lineHeight: 1,
                                flexShrink: 0,
                              }}
                              aria-label={`Remove ${file.name}`}
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Error message */}
                  {errorMessage && (
                    <div
                      style={{
                        background: "rgba(var(--color-danger-rgb, 239,68,68), 0.1)",
                        border: "1px solid var(--color-danger)",
                        borderRadius: "8px",
                        padding: "10px 12px",
                        marginBottom: "16px",
                        color: "var(--color-danger)",
                        fontSize: "13px",
                      }}
                    >
                      {errorMessage}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "none",
                      background: "var(--color-primary)",
                      color: "#fff",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor:
                        status === "submitting" ? "not-allowed" : "pointer",
                      opacity: status === "submitting" ? 0.7 : 1,
                      transition: "opacity 150ms ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    {status === "submitting" ? (
                      <>
                        <span
                          style={{
                            width: "16px",
                            height: "16px",
                            border: "2px solid rgba(255,255,255,0.3)",
                            borderTopColor: "#fff",
                            borderRadius: "50%",
                            animation: "spin 600ms linear infinite",
                            display: "inline-block",
                          }}
                        />
                        Submitting...
                      </>
                    ) : (
                      "Submit"
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* spin keyframe for submit button — fadeIn and slideUp are in globals.css */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
