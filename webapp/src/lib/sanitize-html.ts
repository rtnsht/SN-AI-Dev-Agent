/**
 * Server-side HTML sanitization for banner content.
 * Prevents XSS when rendering admin-controlled HTML.
 */
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = ["b", "i", "u", "em", "strong", "a", "br", "p", "span"];
const ALLOWED_ATTR = ["href", "target", "rel"];

export function sanitizeBannerHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):)/i,
  });
}
