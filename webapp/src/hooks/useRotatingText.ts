"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Shared animation state machine for rotating between text items.
 * Drives the fade-out/fade-in cycle without prescribing any rendering.
 */
export function useRotatingText(count: number, interval: number) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase] = useState<"active" | "exiting">("active");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => {
      setPhase("exiting");
      timeoutRef.current = setTimeout(() => {
        setActiveIdx((prev) => (prev + 1) % count);
        setPhase("active");
      }, 600);
    }, interval);
    return () => {
      clearInterval(id);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [count, interval]);

  return { activeIdx, phase };
}
