"use client";

import Image from "next/image";
import { APP_NAME, APP_LOGO, CREATOR_NAME, CREATOR_LINKEDIN } from "@/lib/branding";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      {/* Logo */}
      {APP_LOGO && (
        <Image
          src={APP_LOGO}
          alt={APP_NAME || "Logo"}
          width={48}
          height={48}
          className="site-footer-logo"
          unoptimized
        />
      )}

      {/* App name */}
      {APP_NAME && (
        <div className="site-footer-name">{APP_NAME}</div>
      )}

      {/* "Built with love" line */}
      <div className="site-footer-love">
        <span>Built with</span>
        <span className="site-footer-heart">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </span>
        <span>for the community</span>
      </div>

      {/* Creator attribution */}
      <div className="site-footer-creator">
        {CREATOR_LINKEDIN ? (
          <a href={CREATOR_LINKEDIN} target="_blank" rel="noopener noreferrer">
            by {CREATOR_NAME}
            <span className="site-footer-linkedin-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </span>
          </a>
        ) : (
          <span>by {CREATOR_NAME}</span>
        )}
      </div>

      {/* Divider */}
      <div className="site-footer-divider" />

      {/* Copyright */}
      <div className="site-footer-copyright">
        &copy; {currentYear} {APP_NAME || "All rights reserved"}.
      </div>
    </footer>
  );
}
