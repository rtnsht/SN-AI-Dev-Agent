import React from "react";
import { Plus, Trash2, Eye, EyeOff, GripVertical, ExternalLink } from "lucide-react";

interface NavLink {
  id: string;
  label: string;
  url: string;
  is_button: boolean;
  button_style: string | null;
  display_order: number;
  is_visible: boolean;
}

interface NavEditorProps {
  navLinks: NavLink[];
  onChange: (navLinks: NavLink[]) => void;
}

export function NavEditor({ navLinks, onChange }: NavEditorProps) {
  const handleAddLink = () => {
    const newLink: NavLink = {
      id: crypto.randomUUID(),
      label: "New Link",
      url: "#",
      is_button: false,
      button_style: null,
      display_order: navLinks.length * 10,
      is_visible: true,
    };
    onChange([...navLinks, newLink]);
  };

  const handleDeleteLink = (id: string) => {
    onChange(navLinks.filter((l) => l.id !== id));
  };

  const handleUpdateLink = (id: string, field: keyof NavLink, value: any) => {
    onChange(navLinks.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newLinks = [...navLinks];
    [newLinks[index], newLinks[index - 1]] = [newLinks[index - 1], newLinks[index]];
    newLinks.forEach((l, i) => l.display_order = i * 10);
    onChange(newLinks);
  };

  const handleMoveDown = (index: number) => {
    if (index === navLinks.length - 1) return;
    const newLinks = [...navLinks];
    [newLinks[index], newLinks[index + 1]] = [newLinks[index + 1], newLinks[index]];
    newLinks.forEach((l, i) => l.display_order = i * 10);
    onChange(newLinks);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Navigation Links</h2>
          <p className="text-sm text-zinc-400">Header navigation items</p>
        </div>
        <button
          onClick={handleAddLink}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Link
        </button>
      </div>

      <div className="space-y-3">
        {navLinks.map((link, index) => (
          <div
            key={link.id}
            className="flex items-center gap-4 p-4 bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
          >
            <GripVertical className="w-5 h-5 text-zinc-500 cursor-move" />
            
            <div className="flex-1 grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-400 mb-1">Label *</label>
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => handleUpdateLink(link.id, "label", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-400 mb-1">URL *</label>
                <input
                  type="text"
                  value={link.url}
                  onChange={(e) => handleUpdateLink(link.id, "url", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://... or /path"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Type</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={link.is_button}
                      onChange={(e) => handleUpdateLink(link.id, "is_button", e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-zinc-300">Button</span>
                  </label>
                </div>
              </div>
            </div>

            {link.is_button && (
              <div className="w-32">
                <label className="block text-xs font-medium text-zinc-400 mb-1">Button Style</label>
                <select
                  value={link.button_style || "primary"}
                  onChange={(e) => handleUpdateLink(link.id, "button_style", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="ghost">Ghost</option>
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleUpdateLink(link.id, "is_visible", !link.is_visible)}
                className={`p-2 rounded-lg transition-colors ${
                  link.is_visible ? "text-green-400 bg-green-400/10" : "text-zinc-500 bg-zinc-700"
                }`}
                title={link.is_visible ? "Hide" : "Show"}
              >
                {link.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
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
                  disabled={index === navLinks.length - 1}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move Down"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              <button
                onClick={() => handleDeleteLink(link.id)}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {navLinks.length === 0 && (
          <div className="text-center py-8 text-zinc-500">
            No navigation links yet. Click "Add Link" to create one.
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="mt-8 pt-6 border-t border-zinc-700">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">Preview</h3>
        <div className="flex items-center gap-2 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
          {navLinks.filter(l => l.is_visible).map((link) => (
            <React.Fragment key={link.id}>
              {link.is_button ? (
                <button
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    link.button_style === "primary"
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : link.button_style === "secondary"
                      ? "bg-zinc-700 text-white hover:bg-zinc-600"
                      : "text-zinc-300 hover:text-white hover:bg-zinc-800"
                  }`}
                >
                  {link.label}
                </button>
              ) : (
                <a
                  href={link.url}
                  className="px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1"
                >
                  {link.label}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
