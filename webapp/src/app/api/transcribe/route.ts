import { NextRequest, NextResponse } from "next/server";
import { checkAccess } from "@/lib/access-tier";
import { getClientIp } from "@/lib/client-ip";

export const maxDuration = 60;

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (Whisper API limit)
const ALLOWED_TYPES = new Set([
  "audio/webm",
  "audio/wav",
  "audio/mp4",
  "audio/ogg",
  "audio/mpeg",
  "audio/x-m4a",
  "video/webm",
]);

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "Whisper transcription not configured" },
        { status: 503 },
      );
    }

    const ip = getClientIp(request);
    const userId = request.headers.get("x-user-id");

    try {
      const access = await checkAccess(ip, userId, false);
      if (!access.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded for transcription." },
          { status: 429 },
        );
      }
    } catch (accessErr) {
      console.error("[transcribe] Access check failed:", accessErr);
      return NextResponse.json(
        { error: "Access verification unavailable." },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum is ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
        { status: 400 },
      );
    }

    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported audio format: ${file.type}` },
        { status: 400 },
      );
    }

    const ext = file.type?.includes("mp4") ? "mp4"
      : file.type?.includes("m4a") ? "m4a"
      : file.type?.includes("ogg") ? "ogg"
      : file.type?.includes("wav") ? "wav"
      : "webm";

    const whisperForm = new FormData();
    whisperForm.append("file", file, `audio.${ext}`);
    whisperForm.append("model", "whisper-1");
    whisperForm.append("response_format", "json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[transcribe] Whisper API error:", res.status, errText);
      return NextResponse.json({ error: "Transcription service error" }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({ text: data.text || "" });
  } catch (err) {
    console.error("[transcribe] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
