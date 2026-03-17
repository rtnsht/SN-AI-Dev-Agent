import { useState, useEffect, useRef } from "react";

/**
 * Shared hook for rotating text animation logic.
 * Auto-toggles between multiple texts with fade transition.
 */
export function useRotatingText(texts: string[], interval = 4000) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase] = useState<"active" | "exiting">("active");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (texts.length < 2) return;
    const id = setInterval(() => {
      setPhase("exiting");
      timeoutRef.current = setTimeout(() => {
        setActiveIdx((prev) => (prev + 1) % texts.length);
        setPhase("active");
      }, 600);
    }, interval);
    return () => {
      clearInterval(id);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [texts.length, interval]);

  return { activeIdx, phase, activeText: texts[activeIdx] };
}
