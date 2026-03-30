import React from "react";
import { Plus, Trash2, Eye, EyeOff, GripVertical, ArrowRight } from "lucide-react";

interface Cta {
  id: string;
  section_id: string;
  headline: string;
  description: string | null;
  button_text: string;
  button_link: string;
  button_style: string;
  background_type: string;
  background_value: string;
  display_order: number;
  is_visible: boolean;
}

interface Section {
  id: string;
  section_key: string;
  title: string | null;
}

interface CtaEditorProps {
  ctas: Cta[];
  sections: Section[];
  onChange: (ctas: Cta[]) => void;
}

export function CtaEditor({ ctas, sections, onChange }: CtaEditorProps) {
  const handleAddCta = () => {
    const ctaSection = sections.find((s) => s.section_key === "cta");
    const newCta: Cta = {
      id: crypto.randomUUID(),
      section_id: ctaSection?.id ?? sections[0]?.id ?? "",
      headline: "Ready to get started?",
      description: "Join thousands of developers shipping faster",
      button_text: "Get Started",
      button_link: "/signup",
      button_style: "primary",
      background_type: "gradient",
      background_value: "linear-gradient(135deg, #4C7DFF, #7C3AED)",
      display_order: ctas.length * 10,
      is_visible: true,
    };
    onChange([...ctas, newCta]);
  };

  const handleDeleteCta = (id: string) => {
    onChange(ctas.filter((c) => c.id !== id));
  };

  const handleUpdateCta = (id: string, field: keyof Cta, value: any) => {
    onChange(ctas.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newCtas = [...ctas];
    [newCtas[index], newCtas[index - 1]] = [newCtas[index - 1], newCtas[index]];
    newCtas.forEach((c, i) => c.display_order = i * 10);
    onChange(newCtas);
  };

  const handleMoveDown = (index: number) => {
    if (index === ctas.length - 1) return;
    const newCtas = [...ctas];
    [newCtas[index], newCtas[index + 1]] = [newCtas[index + 1], newCtas[index]];
    newCtas.forEach((c, i) => c.display_order = i * 10);
    onChange(newCtas);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Call-to-Action Sections</h2>
          <p className="text-sm text-zinc-400">Prominent banners encouraging user action</p>
        </div>
        <button
          onClick={handleAddCta}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add CTA
        </button>
      </div>

      <div className="space-y-6">
        {ctas.map((cta, index) => (
          <div
            key={cta.id}
            className="p-5 bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
          >
            <div className="flex items-start gap-4">
              <GripVertical className="w-5 h-5 text-zinc-500 cursor-move mt-2" />
              
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Headline *</label>
                    <input
                      type="text"
                      value={cta.headline}
                      onChange={(e) => handleUpdateCta(cta.id, "headline", e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Button Style</label>
                    <select
                      value={cta.button_style}
                      onChange={(e) => handleUpdateCta(cta.id, "button_style", e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                      <option value="outline">Outline</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={cta.description || ""}
                    onChange={(e) => handleUpdateCta(cta.id, "description", e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Supporting text"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Button Text</label>
                    <input
                      type="text"
                      value={cta.button_text}
                      onChange={(e) => handleUpdateCta(cta.id, "button_text", e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Button Link</label>
                    <input
                      type="text"
                      value={cta.button_link}
                      onChange={(e) => handleUpdateCta(cta.id, "button_link", e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Background Type</label>
                    <select
                      value={cta.background_type}
                      onChange={(e) => handleUpdateCta(cta.id, "background_type", e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="solid">Solid Color</option>
                      <option value="gradient">Gradient</option>
                      <option value="transparent">Transparent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Background Value</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={cta.background_value}
                        onChange={(e) => handleUpdateCta(cta.id, "background_value", e.target.value)}
                        className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {cta.background_type === "solid" && (
                        <input
                          type="color"
                          value={cta.background_value.startsWith("#") ? cta.background_value : "#000000"}
                          onChange={(e) => handleUpdateCta(cta.id, "background_value", e.target.value)}
                          className="w-10 h-10 rounded cursor-pointer"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">Preview</label>
                  <div
                    className="rounded-lg p-6 text-center"
                    style={{
                      background: cta.background_value,
                      color: cta.background_type === "transparent" ? "white" : "white",
                    }}
                  >
                    <h3 className="text-2xl font-bold mb-2">{cta.headline}</h3>
                    {cta.description && <p className="mb-4 opacity-90">{cta.description}</p>}
                    <button
                      className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 mx-auto ${
                        cta.button_style === "primary"
                          ? "bg-white text-gray-900 hover:bg-gray-100"
                          : cta.button_style === "secondary"
                          ? "bg-black/20 text-white hover:bg-black/30"
                          : "border-2 border-white text-white hover:bg-white/10"
                      }`}
                    >
                      {cta.button_text}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleUpdateCta(cta.id, "is_visible", !cta.is_visible)}
                  className={`p-2 rounded-lg transition-colors ${
                    cta.is_visible ? "text-green-400 bg-green-400/10" : "text-zinc-500 bg-zinc-700"
                  }`}
                  title={cta.is_visible ? "Hide" : "Show"}
                >
                  {cta.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                
                <div className="flex gap-1">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move Up"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === ctas.length - 1}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move Down"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={() => handleDeleteCta(cta.id)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {ctas.length === 0 && (
          <div className="text-center py-8 text-zinc-500">
            No CTAs yet. Click "Add CTA" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
