import React, { useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Upload, ExternalLink, Image as ImageIcon, Video, Sparkles, X } from "lucide-react";

interface Media {
  id: string;
  media_key: string;
  media_type: "image" | "video" | "icon" | "illustration";
  storage_source: string | null;
  storage_path: string | null;
  external_url: string | null;
  alt_text: string;
  width: number | null;
  height: number | null;
  mime_type: string | null;
  file_size: number | null;
  title: string | null;
  description: string | null;
  is_active: boolean;
}

interface MediaEditorProps {
  media: Media[];
  onChange: (media: Media[]) => void;
}

export function MediaEditor({ media, onChange }: MediaEditorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMedia, setNewMedia] = useState<Partial<Media>>({
    media_key: "",
    media_type: "image",
    storage_source: "external",
    external_url: "",
    alt_text: "",
    title: "",
    description: "",
    is_active: true,
  });

  const handleAddMedia = () => {
    if (!newMedia.media_key || !newMedia.alt_text) {
      alert("Media key and alt text are required");
      return;
    }

    const mediaItem: Media = {
      id: crypto.randomUUID(),
      media_key: newMedia.media_key,
      media_type: newMedia.media_type || "image",
      storage_source: newMedia.storage_source || null,
      storage_path: newMedia.storage_path || null,
      external_url: newMedia.external_url || null,
      alt_text: newMedia.alt_text,
      width: newMedia.width || null,
      height: newMedia.height || null,
      mime_type: newMedia.mime_type || null,
      file_size: newMedia.file_size || null,
      title: newMedia.title || null,
      description: newMedia.description || null,
      is_active: newMedia.is_active ?? true,
    };

    onChange([...media, mediaItem]);
    setShowAddForm(false);
    setNewMedia({
      media_key: "",
      media_type: "image",
      storage_source: "external",
      external_url: "",
      alt_text: "",
      title: "",
      description: "",
      is_active: true,
    });
  };

  const handleDeleteMedia = (id: string) => {
    if (confirm("Delete this media item?")) {
      onChange(media.filter((m) => m.id !== id));
    }
  };

  const handleToggleVisibility = (id: string) => {
    onChange(media.map((m) => (m.id === id ? { ...m, is_active: !m.is_active } : m)));
  };

  const handleUpdateMedia = (id: string, field: keyof Media, value: any) => {
    onChange(media.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case "image":
        return <ImageIcon className="w-5 h-5" />;
      case "video":
        return <Video className="w-5 h-5" />;
      case "icon":
        return <Sparkles className="w-5 h-5" />;
      case "illustration":
        return <ImageIcon className="w-5 h-5" />;
      default:
        return <ImageIcon className="w-5 h-5" />;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Media Library</h2>
          <p className="text-sm text-zinc-400">Manage images, videos, and icons for the landing page</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showAddForm ? (
            <>
              <X className="w-4 h-4" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Add Media
            </>
          )}
        </button>
      </div>

      {showAddForm && (
        <div className="mb-6 p-6 bg-zinc-800 rounded-xl border border-zinc-700">
          <h3 className="text-lg font-medium text-white mb-4">Add New Media</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Media Key *</label>
              <input
                type="text"
                value={newMedia.media_key}
                onChange={(e) => setNewMedia({ ...newMedia, media_key: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., hero_visual"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Media Type *</label>
              <select
                value={newMedia.media_type}
                onChange={(e) => setNewMedia({ ...newMedia, media_type: e.target.value as any })}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="icon">Icon</option>
                <option value="illustration">Illustration</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Storage Source</label>
              <select
                value={newMedia.storage_source || "external"}
                onChange={(e) => setNewMedia({ ...newMedia, storage_source: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="external">External URL</option>
                <option value="supabase">Supabase Storage</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">URL or Path *</label>
              <input
                type="text"
                value={newMedia.external_url || ""}
                onChange={(e) => setNewMedia({ ...newMedia, external_url: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://... or /path/to/file"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-400 mb-1">Alt Text *</label>
              <input
                type="text"
                value={newMedia.alt_text}
                onChange={(e) => setNewMedia({ ...newMedia, alt_text: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Accessibility description"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Title (optional)</label>
              <input
                type="text"
                value={newMedia.title || ""}
                onChange={(e) => setNewMedia({ ...newMedia, title: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Internal title"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Description (optional)</label>
              <input
                type="text"
                value={newMedia.description || ""}
                onChange={(e) => setNewMedia({ ...newMedia, description: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Internal notes"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleAddMedia}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Media
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {media.map((item) => (
          <div
            key={item.id}
            className="p-4 bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="p-3 bg-zinc-700 rounded-lg">
                {getMediaIcon(item.media_type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-white truncate">{item.media_key}</h3>
                  {item.is_active ? (
                    <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full">Active</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-zinc-700 text-zinc-400 text-xs rounded-full">Inactive</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mb-2">{item.media_type}</p>
                
                {item.external_url && (
                  <a
                    href={item.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {item.external_url.length > 40 ? item.external_url.slice(0, 40) + "..." : item.external_url}
                  </a>
                )}
              </div>

              <div className="flex gap-1">
                <button
                  onClick={() => handleToggleVisibility(item.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    item.is_active ? "text-green-400 bg-green-400/10" : "text-zinc-500 bg-zinc-700"
                  }`}
                  title={item.is_active ? "Deactivate" : "Activate"}
                >
                  {item.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleDeleteMedia(item.id)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-zinc-700 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-zinc-500">Alt:</span>
                <span className="text-zinc-300 ml-1 truncate block">{item.alt_text}</span>
              </div>
              {item.file_size && (
                <div>
                  <span className="text-zinc-500">Size:</span>
                  <span className="text-zinc-300 ml-1">{formatFileSize(item.file_size)}</span>
                </div>
              )}
              {item.mime_type && (
                <div>
                  <span className="text-zinc-500">MIME:</span>
                  <span className="text-zinc-300 ml-1">{item.mime_type}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {media.length === 0 && (
          <div className="col-span-2 text-center py-8 text-zinc-500">
            <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No media items yet. Click "Add Media" to upload or add external URLs.</p>
          </div>
        )}
      </div>
    </div>
  );
}
