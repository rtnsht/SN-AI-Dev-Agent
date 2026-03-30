import React from "react";
import { Eye, EyeOff } from "lucide-react";

interface Hero {
  id: string;
  headline: string;
  tagline: string | null;
  badge_text: string | null;
  primary_cta_text: string;
  primary_cta_link: string;
  secondary_cta_text: string | null;
  secondary_cta_link: string | null;
  background_type: string;
  background_value: string;
  visual_type: string | null;
  visual_url: string | null;
  visual_alt: string | null;
  layout_split: { left: number; right: number };
  is_active: boolean;
}

interface HeroEditorProps {
  hero: Hero | null;
  onChange: (hero: Hero | null) => void;
}

export function HeroEditor({ hero, onChange }: HeroEditorProps) {
  if (!hero) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">No hero content found</p>
      </div>
    );
  }

  const handleChange = (field: keyof Hero, value: any) => {
    onChange({ ...hero, [field]: value });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Hero Section</h2>
          <p className="text-sm text-zinc-400">Main banner content and layout</p>
        </div>
        <button
          onClick={() => handleChange("is_active", !hero.is_active)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            hero.is_active
              ? "bg-green-600/20 text-green-400 border border-green-600/30"
              : "bg-zinc-700 text-zinc-400 border border-zinc-600"
          }`}
        >
          {hero.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {hero.is_active ? "Active" : "Inactive"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Main Content */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Headline *</label>
            <input
              type="text"
              value={hero.headline}
              onChange={(e) => handleChange("headline", e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Ship ServiceNow Features with AI"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Tagline</label>
            <textarea
              value={hero.tagline || ""}
              onChange={(e) => handleChange("tagline", e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="e.g., Ship features 10x faster with AI-powered development"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Badge Text</label>
            <input
              type="text"
              value={hero.badge_text || ""}
              onChange={(e) => handleChange("badge_text", e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., AI-first · Human-governed"
            />
          </div>
        </div>

        {/* CTAs */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Primary CTA Text</label>
            <input
              type="text"
              value={hero.primary_cta_text}
              onChange={(e) => handleChange("primary_cta_text", e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Get Started"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Primary CTA Link</label>
            <input
              type="text"
              value={hero.primary_cta_link}
              onChange={(e) => handleChange("primary_cta_link", e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., /signup"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Secondary CTA Text</label>
            <input
              type="text"
              value={hero.secondary_cta_text || ""}
              onChange={(e) => handleChange("secondary_cta_text", e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional secondary button"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Secondary CTA Link</label>
            <input
              type="text"
              value={hero.secondary_cta_link || ""}
              onChange={(e) => handleChange("secondary_cta_link", e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional secondary link"
            />
          </div>
        </div>
      </div>

      {/* Background & Visual */}
      <div className="mt-6 pt-6 border-t border-zinc-700">
        <h3 className="text-lg font-medium text-white mb-4">Background & Visual</h3>
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Background Type</label>
            <select
              value={hero.background_type}
              onChange={(e) => handleChange("background_type", e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="solid">Solid Color</option>
              <option value="gradient">Gradient</option>
              <option value="image">Image</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Background Value</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={hero.background_value}
                onChange={(e) => handleChange("background_value", e.target.value)}
                className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="#0B0D12 or linear-gradient(...) or image URL"
              />
              {hero.background_type === "solid" && (
                <input
                  type="color"
                  value={hero.background_value.startsWith("#") ? hero.background_value : "#000000"}
                  onChange={(e) => handleChange("background_value", e.target.value)}
                  className="w-12 h-12 rounded-lg cursor-pointer"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Visual Type</label>
            <select
              value={hero.visual_type || "none"}
              onChange={(e) => handleChange("visual_type", e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="none">None</option>
              <option value="card">Card</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Visual URL</label>
            <input
              type="text"
              value={hero.visual_url || ""}
              onChange={(e) => handleChange("visual_url", e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="URL for image or video"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-zinc-300 mb-2">Layout Split (Left/Right %)</label>
          <div className="flex gap-4 items-center">
            <input
              type="range"
              min="30"
              max="70"
              value={hero.layout_split?.left || 60}
              onChange={(e) => handleChange("layout_split", { left: parseInt(e.target.value), right: 100 - parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="text-zinc-400 text-sm whitespace-nowrap">
              {hero.layout_split?.left || 60}% / {hero.layout_split?.right || 40}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
