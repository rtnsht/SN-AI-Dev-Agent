import React from "react";
import { Plus, Trash2, Eye, EyeOff, GripVertical } from "lucide-react";

interface Feature {
  id: string;
  title: string;
  description: string;
  icon_name: string | null;
  icon_color: string;
  card_style: string;
  link_url: string | null;
  link_text: string | null;
  display_order: number;
  is_visible: boolean;
}

interface Section {
  id: string;
  section_key: string;
  title: string | null;
}

interface FeatureEditorProps {
  features: Feature[];
  sections: Section[];
  onChange: (features: Feature[]) => void;
}

export function FeatureEditor({ features, sections, onChange }: FeatureEditorProps) {
  const handleAddFeature = () => {
    const newFeature: Feature = {
      id: crypto.randomUUID(),
      title: "New Feature",
      description: "Feature description goes here",
      icon_name: "sparkles",
      icon_color: "#4C7DFF",
      card_style: "default",
      link_url: null,
      link_text: null,
      display_order: features.length * 10,
      is_visible: true,
    };
    onChange([...features, newFeature]);
  };

  const handleDeleteFeature = (id: string) => {
    onChange(features.filter((f) => f.id !== id));
  };

  const handleUpdateFeature = (id: string, field: keyof Feature, value: any) => {
    onChange(features.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newFeatures = [...features];
    [newFeatures[index], newFeatures[index - 1]] = [newFeatures[index - 1], newFeatures[index]];
    newFeatures.forEach((f, i) => f.display_order = i * 10);
    onChange(newFeatures);
  };

  const handleMoveDown = (index: number) => {
    if (index === features.length - 1) return;
    const newFeatures = [...features];
    [newFeatures[index], newFeatures[index + 1]] = [newFeatures[index + 1], newFeatures[index]];
    newFeatures.forEach((f, i) => f.display_order = i * 10);
    onChange(newFeatures);
  };

  const iconOptions = [
    { value: "sparkles", label: "Sparkles" },
    { value: "lightning", label: "Lightning" },
    { value: "shield-check", label: "Shield" },
    { value: "zap", label: "Zap" },
    { value: "rocket", label: "Rocket" },
    { value: "code", label: "Code" },
    { value: "database", label: "Database" },
    { value: "lock", label: "Lock" },
    { value: "users", label: "Users" },
    { value: "globe", label: "Globe" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Features</h2>
          <p className="text-sm text-zinc-400">Feature cards displayed in grid layout</p>
        </div>
        <button
          onClick={handleAddFeature}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Feature
        </button>
      </div>

      <div className="space-y-4">
        {features.map((feature, index) => (
          <div
            key={feature.id}
            className="p-5 bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
          >
            <div className="flex items-start gap-4">
              <GripVertical className="w-5 h-5 text-zinc-500 cursor-move mt-2" />
              
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Title *</label>
                  <input
                    type="text"
                    value={feature.title}
                    onChange={(e) => handleUpdateFeature(feature.id, "title", e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Icon</label>
                  <select
                    value={feature.icon_name || "sparkles"}
                    onChange={(e) => handleUpdateFeature(feature.id, "icon_name", e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {iconOptions.map((icon) => (
                      <option key={icon.value} value={icon.value}>
                        {icon.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Description *</label>
                  <textarea
                    value={feature.description}
                    onChange={(e) => handleUpdateFeature(feature.id, "description", e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Icon Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={feature.icon_color}
                      onChange={(e) => handleUpdateFeature(feature.id, "icon_color", e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={feature.icon_color}
                      onChange={(e) => handleUpdateFeature(feature.id, "icon_color", e.target.value)}
                      className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Card Style</label>
                  <select
                    value={feature.card_style}
                    onChange={(e) => handleUpdateFeature(feature.id, "card_style", e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="default">Default</option>
                    <option value="highlighted">Highlighted</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Link URL (optional)</label>
                  <input
                    type="text"
                    value={feature.link_url || ""}
                    onChange={(e) => handleUpdateFeature(feature.id, "link_url", e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Link Text (optional)</label>
                  <input
                    type="text"
                    value={feature.link_text || ""}
                    onChange={(e) => handleUpdateFeature(feature.id, "link_text", e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Learn more"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleUpdateFeature(feature.id, "is_visible", !feature.is_visible)}
                  className={`p-2 rounded-lg transition-colors ${
                    feature.is_visible ? "text-green-400 bg-green-400/10" : "text-zinc-500 bg-zinc-700"
                  }`}
                  title={feature.is_visible ? "Hide" : "Show"}
                >
                  {feature.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
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
                    disabled={index === features.length - 1}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move Down"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={() => handleDeleteFeature(feature.id)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {features.length === 0 && (
          <div className="text-center py-8 text-zinc-500">
            No features yet. Click "Add Feature" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
