import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { checkFeedbackSubmission } from "@/lib/auth-rate-limiter";
import { sendFeedbackNotification } from "@/lib/email";
import crypto from "crypto";
import { getClientIp } from "@/lib/client-ip";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DESCRIPTION_LENGTH = 5000;

function sanitizeText(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(request);
    const rl = await checkFeedbackSubmission(ip);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const type = formData.get("type") as string | null;
    const rawDescription = formData.get("description") as string | null;
    const rawEmail = formData.get("email") as string | null;
    const pageUrl = formData.get("page_url") as string | null;
    const userAgent = formData.get("user_agent") as string | null;

    // Validate type
    if (!type || !["feedback", "bug_report"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be 'feedback' or 'bug_report'." },
        { status: 400 }
      );
    }

    // Validate description
    if (!rawDescription || !rawDescription.trim()) {
      return NextResponse.json(
        { error: "Description is required." },
        { status: 400 }
      );
    }
    const description = sanitizeText(rawDescription).slice(
      0,
      MAX_DESCRIPTION_LENGTH
    );
    if (!description) {
      return NextResponse.json(
        { error: "Description is required." },
        { status: 400 }
      );
    }

    // Validate email (optional)
    const email =
      rawEmail && rawEmail.trim() ? sanitizeText(rawEmail) : null;
    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format." },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Process file attachments
    const attachmentUrls: string[] = [];
    const attachmentData: Array<{
      name: string;
      mime_type: string;
      size: number;
      data_base64: string;
    }> = [];

    const files = formData.getAll("attachments") as File[];
    for (const file of files) {
      if (!(file instanceof File) || file.size === 0) continue;

      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          {
            error: `File type '${file.type}' is not allowed. Accepted: PNG, PDF, DOC, DOCX, XLS, XLSX.`,
          },
          { status: 400 }
        );
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File '${file.name}' exceeds the 10MB size limit.` },
          { status: 400 }
        );
      }

      // Read file buffer
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64Data = buffer.toString("base64");

      // Store file byte data for the table
      attachmentData.push({
        name: file.name,
        mime_type: file.type,
        size: file.size,
        data_base64: base64Data,
      });

      // Upload to Supabase Storage
      const filePath = `feedback/${crypto.randomUUID()}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("feedback-attachments")
        .upload(filePath, buffer, { contentType: file.type });

      if (uploadError) {
        console.error("[feedback] Storage upload failed:", uploadError.message);
        // Continue without storage URL — data is still saved in attachment_data
      } else {
        const { data: urlData } = await supabase.storage
          .from("feedback-attachments")
          .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1-year signed URL

        if (urlData?.signedUrl) {
          attachmentUrls.push(urlData.signedUrl);
        }
      }
    }

    // Insert into database
    const now = new Date().toISOString();
    const { error: insertError } = await supabase
      .from("feedback_reports")
      .insert({
        type,
        description,
        email,
        attachment_urls: attachmentUrls,
        attachment_data: attachmentData,
        page_url: pageUrl || null,
        user_agent: userAgent || null,
        ip_address: ip,
      });

    if (insertError) {
      console.error("[feedback] DB insert failed:", insertError.message);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    // Send email notification to all admins (non-blocking)
    try {
      const { data: admins } = await supabase
        .from("users")
        .select("email, name")
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        const emailPromises = admins.map((admin) =>
          sendFeedbackNotification(admin.email, admin.name, {
            type,
            description,
            email,
            page_url: pageUrl || "Unknown",
            user_agent: userAgent || "Unknown",
            attachment_urls: attachmentUrls,
            created_at: now,
          })
        );
        // Fire and forget — don't block response on email delivery
        Promise.allSettled(emailPromises).catch(() => {});
      }
    } catch (emailErr) {
      console.error("[feedback] Email notification error:", emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[feedback] Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
