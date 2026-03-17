/**
 * Server-side file parser — extracts text content from PDF, Word, and Excel files.
 * Used to convert file attachments into text that can be sent to Claude/OpenRouter.
 */

import type { FileAttachment } from "./sn-engine";

/** Supported document MIME types */
const SUPPORTED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc (limited support)
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
]);

export function isSupportedFileType(mimeType: string): boolean {
  return SUPPORTED_TYPES.has(mimeType);
}

/** Extract text from a file attachment. Returns extracted text or error message. */
export async function extractText(file: FileAttachment): Promise<string> {
  const buffer = Buffer.from(file.data, "base64");

  if (file.mimeType === "application/pdf") {
    return extractPdfText(buffer, file.name);
  }

  if (
    file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.mimeType === "application/msword"
  ) {
    return extractWordText(buffer, file.name);
  }

  if (
    file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.mimeType === "application/vnd.ms-excel"
  ) {
    return extractExcelText(buffer, file.name);
  }

  return `[Unsupported file type: ${file.mimeType}]`;
}

async function extractPdfText(buffer: Buffer, name: string): Promise<string> {
  try {
    // pdf-parse has issues with some ESM/CJS interop, use dynamic require
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const result = await pdfParse(buffer);
    const text = (result.text || "").trim();
    if (!text) return `[PDF "${name}" contained no extractable text (possibly scanned/image-based)]`;
    return text;
  } catch (err) {
    return `[Failed to parse PDF "${name}": ${err instanceof Error ? err.message : String(err)}]`;
  }
}

async function extractWordText(buffer: Buffer, name: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || "").trim();
    if (!text) return `[Word document "${name}" contained no extractable text]`;
    return text;
  } catch (err) {
    return `[Failed to parse Word document "${name}": ${err instanceof Error ? err.message : String(err)}]`;
  }
}

async function extractExcelText(buffer: Buffer, name: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const lines: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      // Convert to CSV for readable text representation
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) {
        lines.push(`--- Sheet: ${sheetName} ---`);
        lines.push(csv.trim());
        lines.push("");
      }
    }

    const text = lines.join("\n").trim();
    if (!text) return `[Excel file "${name}" contained no data]`;
    return text;
  } catch (err) {
    return `[Failed to parse Excel file "${name}": ${err instanceof Error ? err.message : String(err)}]`;
  }
}

/**
 * Process all file attachments in a message, extracting text from each.
 * Returns a formatted string to prepend to the user's message content.
 */
export async function processFileAttachments(files: FileAttachment[]): Promise<string> {
  if (!files || files.length === 0) return "";

  const sections = await Promise.all(
    files.map(async (file) => {
      const text = await extractText(file);
      return `📎 **${file.name}** (${formatSize(file.size)}):\n\n${text}`;
    })
  );

  return sections.join("\n\n---\n\n");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

