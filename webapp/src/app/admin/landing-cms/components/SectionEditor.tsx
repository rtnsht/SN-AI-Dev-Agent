import React from "react";
import { Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";

interface Section {
  id: string;
  section_key: string;
  section_type: string;
  title: string | null;
  subtitle: string | null;
  display_order: number;
  is_visible: boolean;
}

interface SectionEditorProps {
  sections: Section[];
  onChange: (sections: Section[]) => void;
}

export function SectionEditor({ sections, onChange }: SectionEditorProps) {
  const handleToggleVisibility = (id: string) => {
    onChange(
      sections.map((s) => (s.id === id ? { ...s, is_visible: !s.is_visible } : s))
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newSections = [...sections];
    [newSections[index], newSections[index - 1]] = [newSections[index - 1], newSections[index]];
    // Update display_order
    newSections.forEach((s, i) => s.display_order = i * 10);
    onChange(newSections);
  };

  const handleMoveDown = (index: number) => {
    if (index === sections.length - 1) return;
    const newSections = [...sections];
    [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
    // Update display_order
    newSections.forEach((s, i) => s.display_order = i * 10);
    onChange(newSections);
  };

  const handleAddSection = () => {
    const newSection: Section = {
      id: crypto.randomUUID(),
      section_key: `new_section_${Date.now()}`,
      section_type: "custom",
      title: "New Section",
      subtitle: null,
      display_order: sections.length * 10,
      is_visible: true,
    };
    onChange([...sections, newSection]);
  };

  const handleDeleteSection = (id: string) => {
    onChange(sections.filter((s) => s.id !== id));
  };

  const handleUpdateSection = (id: string, field: keyof Section, value: any) => {
    onChange(sections.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Section Management</h2>
          <p className="text-sm text-zinc-400">Control the order and visibility of landing page sections</p>
        </div>
        <button
          onClick={handleAddSection}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Section
        </button>
      </div>

      <div className="space-y-3">
        {sections.map((section, index) => (
          <div
            key={section.id}
            className="flex items-center gap-4 p-4 bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
          >
            <GripVertical className="w-5 h-5 text-zinc-500 cursor-move" />
            
            <div className="flex-1 grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Section Key</label>
                <input
                  type="text"
                  value={section.section_key}
                  onChange={(e) => handleUpdateSection(section.id, "section_key", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Title</label>
                <input
                  type="text"
                  value={section.title || ""}
                  onChange={(e) => handleUpdateSection(section.id, "title", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Type</label>
                <select
                  value={section.section_type}
                  onChange={(e) => handleUpdateSection(section.id, "section_type", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="hero">Hero</option>
                  <option value="two_column">Two Column</option>
                  <option value="cards">Cards</option>
                  <option value="stats">Stats</option>
                  <option value="cta">CTA</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleVisibility(section.id)}
                className={`p-2 rounded-lg transition-colors ${
                  section.is_visible ? "text-green-400 bg-green-400/10" : "text-zinc-500 bg-zinc-700"
                }`}
                title={section.is_visible ? "Hide" : "Show"}
              >
                {section.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
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
                  disabled={index === sections.length - 1}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move Down"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              <button
                onClick={() => handleDeleteSection(section.id)}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
