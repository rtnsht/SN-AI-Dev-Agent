import React from "react";
import { Plus, Trash2, Eye, EyeOff, GripVertical, TrendingUp } from "lucide-react";

interface Stat {
  id: string;
  value: string;
  label: string;
  description: string | null;
  icon_name: string | null;
  display_order: number;
  is_visible: boolean;
}

interface Section {
  id: string;
  section_key: string;
  title: string | null;
}

interface StatsEditorProps {
  stats: Stat[];
  sections: Section[];
  onChange: (stats: Stat[]) => void;
}

export function StatsEditor({ stats, onChange }: StatsEditorProps) {
  const handleAddStat = () => {
    const newStat: Stat = {
      id: crypto.randomUUID(),
      value: "100+",
      label: "New Statistic",
      description: null,
      icon_name: "trending-up",
      display_order: stats.length * 10,
      is_visible: true,
    };
    onChange([...stats, newStat]);
  };

  const handleDeleteStat = (id: string) => {
    onChange(stats.filter((s) => s.id !== id));
  };

  const handleUpdateStat = (id: string, field: keyof Stat, value: any) => {
    onChange(stats.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newStats = [...stats];
    [newStats[index], newStats[index - 1]] = [newStats[index - 1], newStats[index]];
    newStats.forEach((s, i) => s.display_order = i * 10);
    onChange(newStats);
  };

  const handleMoveDown = (index: number) => {
    if (index === stats.length - 1) return;
    const newStats = [...stats];
    [newStats[index], newStats[index + 1]] = [newStats[index + 1], newStats[index]];
    newStats.forEach((s, i) => s.display_order = i * 10);
    onChange(newStats);
  };

  const iconOptions = [
    { value: "trending-up", label: "Trending Up" },
    { value: "users", label: "Users" },
    { value: "clock", label: "Clock" },
    { value: "star", label: "Star" },
    { value: "award", label: "Award" },
    { value: "rocket", label: "Rocket" },
    { value: "check-circle", label: "Check Circle" },
    { value: "zap", label: "Zap" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Statistics</h2>
          <p className="text-sm text-zinc-400">Key metrics and numbers displayed prominently</p>
        </div>
        <button
          onClick={handleAddStat}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Statistic
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, index) => (
          <div
            key={stat.id}
            className="p-5 bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors relative"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={stat.value}
                    onChange={(e) => handleUpdateStat(stat.id, "value", e.target.value)}
                    className="text-2xl font-bold text-white bg-transparent border-none focus:outline-none focus:ring-0 w-full"
                    placeholder="100+"
                  />
                  <input
                    type="text"
                    value={stat.label}
                    onChange={(e) => handleUpdateStat(stat.id, "label", e.target.value)}
                    className="text-sm text-zinc-400 bg-transparent border-none focus:outline-none focus:ring-0 w-full"
                    placeholder="Label"
                  />
                </div>
              </div>

              <div className="flex gap-1">
                <button
                  onClick={() => handleUpdateStat(stat.id, "is_visible", !stat.is_visible)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    stat.is_visible ? "text-green-400 bg-green-400/10" : "text-zinc-500 bg-zinc-700"
                  }`}
                  title={stat.is_visible ? "Hide" : "Show"}
                >
                  {stat.is_visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move Up"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === stats.length - 1}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move Down"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteStat(stat.id)}
                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Icon</label>
                <select
                  value={stat.icon_name || "trending-up"}
                  onChange={(e) => handleUpdateStat(stat.id, "icon_name", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {iconOptions.map((icon) => (
                    <option key={icon.value} value={icon.value}>
                      {icon.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={stat.description || ""}
                  onChange={(e) => handleUpdateStat(stat.id, "description", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional context"
                />
              </div>
            </div>
          </div>
        ))}

        {stats.length === 0 && (
          <div className="col-span-2 text-center py-8 text-zinc-500">
            No statistics yet. Click "Add Statistic" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
