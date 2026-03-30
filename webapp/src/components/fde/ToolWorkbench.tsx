'use client';

import { useState, useMemo } from 'react';
import { X, Search, Folder, FileText, Settings, Bell, FlaskConical, Rocket, ChevronRight, Clock, File } from 'lucide-react';
import type { ToolSelectionMode } from '@/lib/tool-categories';

export interface ToolDef {
  name: string;
  description: string;
  phase?: string;
}

export interface ToolCategory {
  id: string;
  label: string;
  icon: string;
  description: string;
  tools: ToolDef[];
}

export interface Artifact {
  id: string;
  title: string;
  type: string;
  createdAt: Date;
}

export interface ToolWorkbenchProps {
  categories: ToolCategory[];
  selectedCategory?: string;
  selectionMode: ToolSelectionMode;
  selectedToolNames: string[];
  onToggleToolSelection: (toolName: string) => void;
  onSelectionModeChange: (mode: ToolSelectionMode) => void;
  onSelectTool: (toolName: string) => void;
  onClose: () => void;
  recentArtifacts?: Artifact[];
  isOpen: boolean;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  core: <Folder className="w-4 h-4" />,
  scripts: <FileText className="w-4 h-4" />,
  notifications: <Bell className="w-4 h-4" />,
  quality: <FlaskConical className="w-4 h-4" />,
  analysis: <Search className="w-4 h-4" />,
  data_import: <File className="w-4 h-4" />,
  diagrams: <Settings className="w-4 h-4" />,
  deployment: <Rocket className="w-4 h-4" />,
};

export function ToolWorkbench({
  categories,
  selectedCategory,
  selectionMode,
  selectedToolNames,
  onToggleToolSelection,
  onSelectionModeChange,
  onSelectTool,
  onClose,
  recentArtifacts = [],
  isOpen
}: ToolWorkbenchProps) {
  const [activeCategory, setActiveCategory] = useState<string>(selectedCategory || categories[0]?.id || 'core');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilesPopup, setShowFilesPopup] = useState(false);
  const [filesTab, setFilesTab] = useState<'recent' | 'all'>('recent');

  const activeCategoryData = useMemo(() =>
    categories.find(c => c.id === activeCategory) || categories[0],
    [categories, activeCategory]
  );

  const filteredTools = useMemo(() => {
    if (!searchQuery) return activeCategoryData.tools;
    const query = searchQuery.toLowerCase();
    return activeCategoryData.tools.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query)
    );
  }, [activeCategoryData, searchQuery]);

  const totalTools = useMemo(() =>
    categories.reduce((sum, c) => sum + c.tools.length, 0),
    [categories]
  );

  const selectedTools = activeCategoryData.tools.length;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tool-workbench-title"
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Category Sidebar */}
        <div className="w-48 border-r border-zinc-700 flex flex-col">
          <div className="p-3 border-b border-zinc-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-300">Categories</h3>
            <span className="text-xs text-zinc-500">{totalTools} tools</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1" role="listbox" aria-label="Tool categories">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-sm ${
                  activeCategory === cat.id
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
                role="option"
                aria-selected={activeCategory === cat.id}
              >
                {CATEGORY_ICONS[cat.id] || <Folder className="w-4 h-4" />}
                <span className="flex-1">{cat.label}</span>
                <span className="text-xs text-zinc-500">{cat.tools.length}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
            <div>
              <h2 id="tool-workbench-title" className="text-lg font-medium text-white">{activeCategoryData.label}</h2>
              <p className="text-sm text-zinc-400">{activeCategoryData.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 mr-2">
                <button
                  onClick={() => onSelectionModeChange('categories')}
                  className={`px-2.5 py-1.5 rounded text-xs ${selectionMode === 'categories' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                >
                  Categories
                </button>
                <button
                  onClick={() => onSelectionModeChange('custom')}
                  className={`px-2.5 py-1.5 rounded text-xs ${selectionMode === 'custom' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                >
                  Custom
                </button>
                <button
                  onClick={() => onSelectionModeChange('all')}
                  className={`px-2.5 py-1.5 rounded text-xs ${selectionMode === 'all' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                >
                  All
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 px-3 py-1.5 pl-8 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  aria-label="Search tools"
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
              </div>
              <button
                onClick={() => setShowFilesPopup(!showFilesPopup)}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-sm text-zinc-300"
                aria-expanded={showFilesPopup}
                aria-haspopup="true"
                aria-label="Toggle files panel"
              >
                <File className="w-4 h-4" aria-hidden="true" />
                Files
                {recentArtifacts.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-zinc-600 rounded text-xs">{recentArtifacts.length}</span>
                )}
              </button>
              <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded" aria-label="Close tool workbench">
                <X className="w-5 h-5 text-zinc-400" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Tools Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-400">
                {filteredTools.length} / {selectedTools} tools
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 bg-zinc-800 rounded text-zinc-500">
                  {activeCategory.toUpperCase()}
                </span>
                <span className="text-xs px-2 py-1 bg-zinc-800 rounded text-zinc-500">
                  {selectionMode === 'all' ? 'ALL TOOLS' : selectionMode === 'custom' ? `${selectedToolNames.length} CUSTOM` : 'CATEGORY SET'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2" role="list" aria-label="Available tools">
              {filteredTools.map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-start gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded text-left group"
                  role="listitem"
                >
                  <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center flex-shrink-0 group-hover:bg-zinc-600">
                    <Settings className="w-4 h-4 text-zinc-400" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{tool.name}</div>
                    <div className="text-xs text-zinc-500 truncate">{tool.description}</div>
                    <div className="mt-3 flex items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-zinc-400">
                        <input
                          type="checkbox"
                          checked={selectedToolNames.includes(tool.name)}
                          onChange={() => onToggleToolSelection(tool.name)}
                        />
                        Include
                      </label>
                      <button
                        type="button"
                        onClick={() => onSelectTool(tool.name)}
                        className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-[11px] text-zinc-200"
                      >
                        Insert prompt
                      </button>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0 mt-1" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Files Popup */}
        {showFilesPopup && (
          <div
            className="absolute top-16 right-4 w-80 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl"
            role="dialog"
            aria-label="Files panel"
          >
            <div className="flex border-b border-zinc-700" role="tablist">
              <button
                onClick={() => setFilesTab('recent')}
                className={`flex-1 px-4 py-2 text-sm ${
                  filesTab === 'recent' ? 'text-white border-b-2 border-white' : 'text-zinc-400'
                }`}
                role="tab"
                aria-selected={filesTab === 'recent'}
              >
                Recent
              </button>
              <button
                onClick={() => setFilesTab('all')}
                className={`flex-1 px-4 py-2 text-sm ${
                  filesTab === 'all' ? 'text-white border-b-2 border-white' : 'text-zinc-400'
                }`}
                role="tab"
                aria-selected={filesTab === 'all'}
              >
                All
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto p-2" role="list" aria-label="Artifacts list">
              {(filesTab === 'recent' ? recentArtifacts.slice(0, 10) : recentArtifacts).map((artifact) => (
                <button
                  key={artifact.id}
                  className="w-full flex items-center gap-2 p-2 hover:bg-zinc-700 rounded text-left"
                  onClick={() => setShowFilesPopup(false)}
                  role="listitem"
                  aria-label={`Open ${artifact.title}`}
                >
                  <FileText className="w-4 h-4 text-zinc-500" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{artifact.title}</div>
                    <div className="text-xs text-zinc-500">{artifact.type}</div>
                  </div>
                  <Clock className="w-3 h-3 text-zinc-600" aria-hidden="true" />
                </button>
              ))}
              {recentArtifacts.length === 0 && (
                <div className="text-sm text-zinc-500 text-center py-4">No artifacts available</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
