"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { BRAND_COLORS_DARK, BRAND_COLORS_LIGHT } from "@/lib/branding";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/** Apply branding color CSS vars as inline styles on <html> */
function applyBrandColors(theme: Theme) {
  const colors = theme === "light" ? BRAND_COLORS_LIGHT : BRAND_COLORS_DARK;
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(colors)) {
    root.style.setProperty(prop, value);
  }
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Restore saved theme from localStorage (defaults to dark)
  useEffect(() => {
    const saved = localStorage.getItem("app-theme");
    const initial: Theme = saved === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
    applyBrandColors(initial);
    setMounted(true);
  }, []);

  // Sync attribute + branding colors whenever theme changes (after mount)
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", theme);
    applyBrandColors(theme);
    localStorage.setItem("app-theme", theme);
  }, [theme, mounted]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

