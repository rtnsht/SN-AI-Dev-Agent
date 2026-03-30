import React from "react";
import { Plus, Trash2, Eye, EyeOff, GripVertical, FolderOpen } from "lucide-react";

interface FooterLink {
  id: string;
  category: string;
  label: string;
  url: string;
  display_order: number;
  is_visible: boolean;
}

interface FooterEditorProps {
  footerLinks: FooterLink[];
  onChange: (footerLinks: FooterLink[]) => void;
}

export function FooterEditor({ footerLinks, onChange }: FooterEditorProps) {
  const categories = Array.from(new Set(footerLinks.map(l => l.category)));
  
  const handleAddLink = (category: string = "General") => {
    const newLink: FooterLink = {
      id: crypto.randomUUID(),
      category,
      label: "New Link",
      url: "#",
      display_order: footerLinks.filter(l => l.category === category).length * 10,
      is_visible: true,
    };
    onChange([...footerLinks, newLink]);
  };

  const handleAddCategory = () => {
    const newCategory = prompt("Enter new category name:");
    if (newCategory && newCategory.trim()) {
      handleAddLink(newCategory.trim());
    }
  };

  const handleDeleteLink = (id: string) => {
    onChange(footerLinks.filter((l) => l.id !== id));
  };

  const handleUpdateLink = (id: string, field: keyof FooterLink, value: any) => {
    onChange(footerLinks.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const handleMoveUp = (linkId: string) => {
    const index = footerLinks.findIndex(l => l.id === linkId);
    if (index === 0) return;
    
    const category = footerLinks[index].category;
    const categoryLinks = footerLinks.filter(l => l.category === category);
    const linkIndex = categoryLinks.findIndex(l => l.id === linkId);
    
    if (linkIndex === 0) return;
    
    const newLinks = [...footerLinks];
    const categoryIndices = newLinks
      .map((l, i) => ({ id: l.id, index: i, category: l.category }))
      .filter(i => i.category === category)
      .map(i => i.index);
    
    const currentIndex = categoryIndices[linkIndex];
    const prevIndex = categoryIndices[linkIndex - 1];
    
    [newLinks[currentIndex], newLinks[prevIndex]] = [newLinks[prevIndex], newLinks[currentIndex]];
    
    // Reorder display_order within category
    newLinks
      .filter(l => l.category === category)
      .forEach((l, i) => l.display_order = i * 10);
    
    onChange(newLinks);
  };

  const handleMoveDown = (linkId: string) => {
    const index = footerLinks.findIndex(l => l.id === linkId);
    if (index === footerLinks.length - 1) return;
    
    const category = footerLinks[index].category;
    const categoryLinks = footerLinks.filter(l => l.category === category);
    const linkIndex = categoryLinks.findIndex(l => l.id === linkId);
    
    if (linkIndex === categoryLinks.length - 1) return;
    
    const newLinks = [...footerLinks];
    const categoryIndices = newLinks
      .map((l, i) => ({ id: l.id, index: i, category: l.category }))
      .filter(i => i.category === category)
      .map(i => i.index);
    
    const currentIndex = categoryIndices[linkIndex];
    const nextIndex = categoryIndices[linkIndex + 1];
    
    [newLinks[currentIndex], newLinks[nextIndex]] = [newLinks[nextIndex], newLinks[currentIndex]];
    
    // Reorder display_order within category
    newLinks
      .filter(l => l.category === category)
      .forEach((l, i) => l.display_order = i * 10);
    
    onChange(newLinks);
  };

  const handleDeleteCategory = (category: string) => {
    if (confirm(`Delete all links in "${category}"?`)) {
      onChange(footerLinks.filter(l => l.category !== category));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Footer Links</h2>
          <p className="text-sm text-zinc-400">Organized by category</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAddCategory}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            Add Category
          </button>
          <button
            onClick={() => handleAddLink()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Link
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {categories.map((category) => {
          const categoryLinks = footerLinks.filter(l => l.category === category);
          
          return (
            <div key={category} className="bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-zinc-700/50 border-b border-zinc-700">
                <div className="flex items-center gap-3">
                  <FolderOpen className="w-5 h-5 text-blue-400" />
                  <h3 className="font-medium text-white">{category}</h3>
                  <span className="text-xs text-zinc-500">({categoryLinks.length} links)</span>
                </div>
                <button
                  onClick={() => handleAddLink(category)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                >
                  + Add Link
                </button>
              </div>

              <div className="p-4 space-y-2">
                {categoryLinks.map((link, index) => (
                  <div
                    key={link.id}
                    className="flex items-center gap-4 p-3 bg-zinc-900 rounded-lg border border-zinc-800"
                  >
                    <GripVertical className="w-5 h-5 text-zinc-500 cursor-move" />
                    
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Label *</label>
                        <input
                          type="text"
                          value={link.label}
                          onChange={(e) => handleUpdateLink(link.id, "label", e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">URL *</label>
                        <input
                          type="text"
                          value={link.url}
                          onChange={(e) => handleUpdateLink(link.id, "url", e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="https://... or /path"
                        />
                      </div>
                    </div>

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
                          onClick={() => handleMoveUp(link.id)}
                          disabled={index === 0}
                          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Move Up"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleMoveDown(link.id)}
                          disabled={index === categoryLinks.length - 1}
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

                {categoryLinks.length === 0 && (
                  <div className="text-center py-4 text-zinc-500 text-sm">
                    No links in this category
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {categories.length === 0 && (
          <div className="text-center py-8 text-zinc-500">
            No footer links yet. Click "Add Category" to get started.
          </div>
        )}
      </div>
    </div>
  );
}
