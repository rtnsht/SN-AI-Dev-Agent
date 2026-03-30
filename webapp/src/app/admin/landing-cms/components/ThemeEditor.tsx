import React from "react";
import { Sun, Moon, Palette } from "lucide-react";

interface ThemeConfig {
  id: string;
  theme_mode: string;
  bg_primary: string;
  bg_secondary: string;
  bg_elevated: string;
  text_primary: string;
  text_secondary: string;
  text_muted: string;
  accent_primary: string;
  accent_primary_hover: string | null;
  accent_secondary: string | null;
  border_color: string | null;
  shadow_value: string | null;
  font_family: string;
  headline_hero: string;
  headline_section: string;
  body_large: string;
  body: string;
  is_active: boolean;
}

interface ThemeEditorProps {
  themeConfig: {
    dark: ThemeConfig | null;
    light: ThemeConfig | null;
  };
  onChange: (themeConfig: { dark: ThemeConfig | null; light: ThemeConfig | null }) => void;
}

export function ThemeEditor({ themeConfig, onChange }: ThemeEditorProps) {
  const [activeTab, setActiveTab] = React.useState<"dark" | "light">("dark");

  const handleUpdateTheme = (mode: "dark" | "light", field: keyof ThemeConfig, value: any) => {
    const current = themeConfig[mode];
    if (!current) return;
    
    onChange({
      ...themeConfig,
      [mode]: { ...current, [field]: value },
    });
  };

  const ColorInput = ({ 
    label, 
    value, 
    onChange 
  }: { 
    label: string; 
    value: string | null; 
    onChange: (value: string) => void;
  }) => (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded cursor-pointer"
        />
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          placeholder="#000000"
        />
      </div>
    </div>
  );

  const TextInput = ({ 
    label, 
    value, 
    onChange,
    placeholder
  }: { 
    label: string; 
    value: string; 
    onChange: (value: string) => void;
    placeholder?: string;
  }) => (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        placeholder={placeholder}
      />
    </div>
  );

  const ThemeSection = ({ mode, icon: Icon }: { mode: "dark" | "light"; icon: any }) => {
    const theme = themeConfig[mode];
    if (!theme) return <div className="text-center py-8 text-zinc-500">No {mode} theme configured</div>;

    return (
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-3">Background Colors</label>
          <div className="grid grid-cols-3 gap-4">
            <ColorInput
              label="Primary"
              value={theme.bg_primary}
              onChange={(v) => handleUpdateTheme(mode, "bg_primary", v)}
            />
            <ColorInput
              label="Secondary"
              value={theme.bg_secondary}
              onChange={(v) => handleUpdateTheme(mode, "bg_secondary", v)}
            />
            <ColorInput
              label="Elevated"
              value={theme.bg_elevated}
              onChange={(v) => handleUpdateTheme(mode, "bg_elevated", v)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-3">Text Colors</label>
          <div className="grid grid-cols-3 gap-4">
            <ColorInput
              label="Primary"
              value={theme.text_primary}
              onChange={(v) => handleUpdateTheme(mode, "text_primary", v)}
            />
            <ColorInput
              label="Secondary"
              value={theme.text_secondary}
              onChange={(v) => handleUpdateTheme(mode, "text_secondary", v)}
            />
            <ColorInput
              label="Muted"
              value={theme.text_muted}
              onChange={(v) => handleUpdateTheme(mode, "text_muted", v)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-3">Accent Colors</label>
          <div className="grid grid-cols-3 gap-4">
            <ColorInput
              label="Primary"
              value={theme.accent_primary}
              onChange={(v) => handleUpdateTheme(mode, "accent_primary", v)}
            />
            <ColorInput
              label="Primary Hover"
              value={theme.accent_primary_hover}
              onChange={(v) => handleUpdateTheme(mode, "accent_primary_hover", v)}
            />
            <ColorInput
              label="Secondary"
              value={theme.accent_secondary}
              onChange={(v) => handleUpdateTheme(mode, "accent_secondary", v)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-3">Border & Shadow</label>
          <div className="grid grid-cols-2 gap-4">
            <ColorInput
              label="Border Color"
              value={theme.border_color}
              onChange={(v) => handleUpdateTheme(mode, "border_color", v)}
            />
            <TextInput
              label="Shadow Value"
              value={theme.shadow_value || ""}
              onChange={(v) => handleUpdateTheme(mode, "shadow_value", v)}
              placeholder="0 4px 24px rgba(0,0,0,0.4)"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-3">Typography</label>
          <div className="grid grid-cols-2 gap-4">
            <TextInput
              label="Font Family"
              value={theme.font_family}
              onChange={(v) => handleUpdateTheme(mode, "font_family", v)}
              placeholder="Inter, sans-serif"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-3">Font Sizes (CSS values)</label>
          <div className="grid grid-cols-2 gap-4">
            <TextInput
              label="Hero Headline"
              value={theme.headline_hero}
              onChange={(v) => handleUpdateTheme(mode, "headline_hero", v)}
              placeholder="clamp(48px, 8vw, 80px)"
            />
            <TextInput
              label="Section Headline"
              value={theme.headline_section}
              onChange={(v) => handleUpdateTheme(mode, "headline_section", v)}
              placeholder="clamp(32px, 4vw, 48px)"
            />
            <TextInput
              label="Body Large"
              value={theme.body_large}
              onChange={(v) => handleUpdateTheme(mode, "body_large", v)}
              placeholder="20px"
            />
            <TextInput
              label="Body"
              value={theme.body}
              onChange={(v) => handleUpdateTheme(mode, "body", v)}
              placeholder="16px"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Theme Configuration</h2>
          <p className="text-sm text-zinc-400">Customize colors and typography for light/dark modes</p>
        </div>
      </div>

      <div className="mb-6">
        <div className="inline-flex rounded-lg bg-zinc-800 p-1">
          <button
            onClick={() => setActiveTab("dark")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "dark"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Moon className="w-4 h-4" />
            Dark Theme
          </button>
          <button
            onClick={() => setActiveTab("light")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "light"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Sun className="w-4 h-4" />
            Light Theme
          </button>
        </div>
      </div>

      <div className="p-6 bg-zinc-800 rounded-xl border border-zinc-700">
        {activeTab === "dark" && <ThemeSection mode="dark" icon={Moon} />}
        {activeTab === "light" && <ThemeSection mode="light" icon={Sun} />}
      </div>
    </div>
  );
}
