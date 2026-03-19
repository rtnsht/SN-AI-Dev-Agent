/**
 * ZeptoMail transactional email helper.
 * Sends plain-text emails via the ZeptoMail Send Mail API.
 */

import { fetchWithTimeout } from "./fetch-with-timeout";

const ZEPTOMAIL_API_URL = process.env.ZEPTOMAIL_API_URL || "https://api.zeptomail.com/v1.1/email";
const ZEPTOMAIL_API_KEY = process.env.ZEPTOMAIL_API_KEY || "";
const FROM_EMAIL = process.env.ZEPTOMAIL_FROM_EMAIL || "";
const FROM_NAME = process.env.ZEPTOMAIL_FROM_NAME || "SN AI Agent";
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const FETCH_TIMEOUT_MS = 15_000;

interface SendEmailOpts {
  to: string;
  toName?: string;
  subject: string;
  body: string;
}

export async function sendEmail(opts: SendEmailOpts): Promise<{ success: boolean; error?: string }> {
  if (!ZEPTOMAIL_API_KEY || !FROM_EMAIL) {
    console.warn("[email] ZeptoMail not configured — skipping email send");
    return { success: false, error: "Email not configured" };
  }

  try {
    const payload: Record<string, unknown> = {
      from: { address: FROM_EMAIL, name: FROM_NAME },
      to: [{ email_address: { address: opts.to, name: opts.toName || opts.to } }],
      subject: opts.subject,
      textbody: opts.body,
    };

    const res = await fetchWithTimeout(ZEPTOMAIL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ZEPTOMAIL_API_KEY,
      },
      body: JSON.stringify(payload),
      timeoutMs: FETCH_TIMEOUT_MS,
    });

    const responseText = res.ok ? "" : await res.text();

    if (!res.ok) {
      console.error("[email] ZeptoMail error:", res.status, responseText);
      return { success: false, error: `ZeptoMail ${res.status}: ${responseText}` };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] Send failed:", msg);
    return { success: false, error: msg };
  }
}

// ── Email template helpers ──────────────────────────────────────

export function sendVerifyEmail(name: string, email: string, token: string) {
  return sendEmail({
    to: email,
    toName: name,
    subject: "Verify your email — SN AI Agent",
    body: `Hi ${name},

Please verify your email to complete your access request:

${APP_URL}/auth/verify-email?token=${token}

This link expires in 24 hours.

If you didn't request this, ignore this email.

— SN AI Agent`,
  });
}

export function sendOTPEmail(name: string, email: string, otp: string) {
  return sendEmail({
    to: email,
    toName: name,
    subject: `${otp} is your verification code — SN AI Agent`,
    body: `Hi ${name},

Your verification code is: ${otp}

This code expires in 10 minutes.

If you didn't request this, ignore this email.

— SN AI Agent`,
  });
}

export function sendAdminNotification(name: string, email: string, company: string | null, useCase: string, createdAt: string) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return Promise.resolve({ success: false, error: "ADMIN_EMAIL not set" });

  return sendEmail({
    to: adminEmail,
    subject: `New access request: ${name} (${email})`,
    body: `New access request:

Name: ${name}
Email: ${email}
Company: ${company || "—"}
Use case: ${useCase}
Submitted: ${createdAt}

Review at: ${APP_URL}/admin

— SN AI Agent`,
  });
}

export function sendApprovalEmail(name: string, email: string, token: string) {
  return sendEmail({
    to: email,
    toName: name,
    subject: "You're in — SN AI Agent",
    body: `Hi ${name},

Your access request has been approved!

Click below to set up your account:

${APP_URL}/auth/verify?token=${token}

This link expires in 72 hours.

— SN AI Agent`,
  });
}

export function sendPasswordResetEmail(name: string, email: string, token: string) {
  return sendEmail({
    to: email,
    toName: name,
    subject: "Reset your password — SN AI Agent",
    body: `Hi ${name},

Click below to reset your password:

${APP_URL}/auth/verify?token=${token}

This link expires in 72 hours.

If you didn't request this, ignore this email.

— SN AI Agent`,
  });
}

export function sendFeedbackNotification(
  adminEmail: string,
  adminName: string,
  feedback: {
    type: string;
    description: string;
    email: string | null;
    page_url: string;
    user_agent: string;
    attachment_urls: string[];
    created_at: string;
  }
) {
  const typeLabel = feedback.type === "bug_report" ? "Bug Report" : "Feedback";
  const attachmentSection =
    feedback.attachment_urls.length > 0
      ? `\nAttachments:\n${feedback.attachment_urls.map((url, i) => `  ${i + 1}. ${url}`).join("\n")}\n`
      : "";

  return sendEmail({
    to: adminEmail,
    toName: adminName,
    subject: `[New Feedback] ${typeLabel}`,
    body: `Hi ${adminName},

A new ${typeLabel.toLowerCase()} has been submitted.

Type: ${typeLabel}
Description: ${feedback.description}
Submitted by: ${feedback.email || "Anonymous"}
Page: ${feedback.page_url}
Browser/Device: ${feedback.user_agent}
Submitted: ${feedback.created_at}
${attachmentSection}
Review at: ${APP_URL}/admin

— ${FROM_NAME}`,
  });
}

