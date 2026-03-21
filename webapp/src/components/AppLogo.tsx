"use client";

/**
 * Inline hero logo — structure must stay aligned with `public/logo-r-v10.svg`
 * when updating brand art. Static `<Image src={APP_LOGO}>` remains for small chrome.
 */
import { APP_NAME } from "@/lib/branding";

const VIEW_CENTER = 256;

export type AppLogoProps = {
  /** Fixed size in CSS px; omit to fill parent (use with sized `.hero-logo-container`). */
  size?: number;
  className?: string;
  /** When true, orbital groups rotate (respects `prefers-reduced-motion` via CSS). */
  animated?: boolean;
  /** Unique prefix for SVG defs ids (avoids collisions if multiple instances mount). */
  idPrefix?: string;
  /** Accessible name; defaults to APP_NAME. */
  title?: string;
};

function safeIdPrefix(raw: string): string {
  const s = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  return s || "app-logo";
}

export default function AppLogo({
  size,
  className = "",
  animated = true,
  idPrefix = "app-logo",
  title,
}: AppLogoProps) {
  const pid = safeIdPrefix(idPrefix);
  const label = title ?? (APP_NAME || "Logo");
  const titleId = `${pid}-title`;
  const dim = size === undefined ? "100%" : size;

  const orbitA = animated ? "app-logo-orbit-a" : "";
  const orbitB = animated ? "app-logo-orbit-b" : "";
  const innerRing = animated ? "app-logo-inner-ring" : "";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      width={dim}
      height={dim}
      preserveAspectRatio="xMidYMid meet"
      className={`app-logo-svg ${className}`.trim()}
      role="img"
      aria-labelledby={titleId}
      shapeRendering="geometricPrecision"
    >
      <title id={titleId}>{label}</title>
      <defs>
        <linearGradient id={`${pid}-g10`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="100%" stopColor="var(--color-accent-from)" />
        </linearGradient>
        <linearGradient id={`${pid}-ringGrad1`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
          <stop offset="50%" stopColor="var(--color-primary)" stopOpacity={0.35} />
          <stop offset="100%" stopColor="var(--color-accent-from)" stopOpacity={0.5} />
        </linearGradient>
        <linearGradient id={`${pid}-ringGrad2`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--color-accent-from)" stopOpacity={0.45} />
          <stop offset="50%" stopColor="var(--color-accent-from)" stopOpacity={0.3} />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.45} />
        </linearGradient>
        <linearGradient id={`${pid}-coreGrad`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--surface-primary)" />
          <stop offset="100%" stopColor="var(--surface-elevated)" />
        </linearGradient>
        <radialGradient id={`${pid}-innerGlow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.08} />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
        </radialGradient>
        <filter id={`${pid}-orbitalGlow`} x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${pid}-softGlow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer ambient ring — static */}
      <g className="app-logo-ambient">
        <circle
          cx={VIEW_CENTER}
          cy={VIEW_CENTER}
          r={244}
          fill="none"
          stroke={`url(#${pid}-ringGrad1)`}
          strokeWidth={0.75}
          opacity={0.15}
        />
        <circle
          cx={VIEW_CENTER}
          cy={VIEW_CENTER}
          r={248}
          fill="none"
          stroke="#60a5fa"
          strokeWidth={0.5}
          opacity={0.06}
        />
      </g>

      {/* Orbit A — rings + nearby accent dots rotate together (90s drift) */}
      <g
        className={orbitA}
        style={{ transformOrigin: `${VIEW_CENTER}px ${VIEW_CENTER}px` }}
      >
        <ellipse
          cx={VIEW_CENTER}
          cy={VIEW_CENTER}
          rx={232}
          ry={96}
          stroke={`url(#${pid}-ringGrad1)`}
          strokeWidth={1.8}
          opacity={0.4}
          fill="none"
          transform={`rotate(-25 ${VIEW_CENTER} ${VIEW_CENTER})`}
          filter={`url(#${pid}-orbitalGlow)`}
        />
        <ellipse
          cx={VIEW_CENTER}
          cy={VIEW_CENTER}
          rx={232}
          ry={96}
          stroke={`url(#${pid}-ringGrad2)`}
          strokeWidth={1.8}
          opacity={0.4}
          fill="none"
          transform={`rotate(25 ${VIEW_CENTER} ${VIEW_CENTER})`}
          filter={`url(#${pid}-orbitalGlow)`}
        />
        {/* Accent dots near -25/+25 rings */}
        <circle cx={364} cy={172} r={10} fill="#a78bfa" filter={`url(#${pid}-softGlow)`} />
        <circle cx={364} cy={172} r={5} fill="#c4b5fd" opacity={0.6} />
        <circle cx={98} cy={198} r={4.5} fill="#60a5fa" opacity={0.8} />
        <circle cx={98} cy={198} r={2} fill="#93c5fd" opacity={0.5} />
        <circle cx={328} cy={100} r={2.5} fill="#818cf8" opacity={0.4} />
        <circle cx={178} cy={130} r={2} fill="#a78bfa" opacity={0.3} />
      </g>

      {/* Orbit B — rings + nearby accent dots rotate together (120s drift, reverse) */}
      <g
        className={orbitB}
        style={{ transformOrigin: `${VIEW_CENTER}px ${VIEW_CENTER}px` }}
      >
        <ellipse
          cx={VIEW_CENTER}
          cy={VIEW_CENTER}
          rx={228}
          ry={88}
          stroke="#c084fc"
          strokeWidth={1.2}
          opacity={0.18}
          fill="none"
          transform={`rotate(70 ${VIEW_CENTER} ${VIEW_CENTER})`}
          filter={`url(#${pid}-orbitalGlow)`}
        />
        <ellipse
          cx={VIEW_CENTER}
          cy={VIEW_CENTER}
          rx={226}
          ry={80}
          stroke="#818cf8"
          strokeWidth={0.8}
          opacity={0.12}
          fill="none"
          transform={`rotate(-60 ${VIEW_CENTER} ${VIEW_CENTER})`}
        />
        {/* Accent dots near 70/-60 rings */}
        <circle cx={418} cy={318} r={4} fill="#c084fc" opacity={0.7} />
        <circle cx={148} cy={378} r={3.5} fill="#60a5fa" opacity={0.6} />
        <circle cx={390} cy={390} r={2} fill="#60a5fa" opacity={0.25} />
      </g>

      {/* Core nucleus */}
      <circle cx={VIEW_CENTER} cy={VIEW_CENTER} r={152} fill={`url(#${pid}-coreGrad)`} />
      <circle cx={VIEW_CENTER} cy={VIEW_CENTER} r={152} fill={`url(#${pid}-innerGlow)`} />
      <circle
        cx={VIEW_CENTER}
        cy={VIEW_CENTER}
        r={152}
        fill="none"
        stroke="#60a5fa"
        strokeWidth={5}
        opacity={0.06}
      />
      <circle
        className={innerRing}
        cx={VIEW_CENTER}
        cy={VIEW_CENTER}
        r={152}
        fill="none"
        stroke={`url(#${pid}-g10)`}
        strokeWidth={2.5}
        opacity={0.6}
      />

      <path
        d="M222 348 V218 Q222 170 276 156 Q324 146 364 172"
        stroke={`url(#${pid}-g10)`}
        strokeWidth={34}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter={`url(#${pid}-softGlow)`}
      />
    </svg>
  );
}
