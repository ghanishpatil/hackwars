import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { NeonCard } from '../components/NeonCard';
import { AnimatedButton } from '../components/AnimatedButton';
import { adminApi } from '../api/client';

const MISSION_IDS = [
  { id: 'mission-exploit', label: 'Mission Exploit' },
  { id: 'mission-exploit-2', label: 'Mission Exploit 2.0' },
];

export default function AdminLanding() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', tag: '', description: '', images: [] });
  const [saveLoading, setSaveLoading] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  const fetchMissions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getLandingMissions();
      setMissions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load landing missions');
      setMissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  const openEdit = (mission) => {
    setEditingId(mission.id);
    setForm({
      title: mission.title ?? '',
      tag: mission.tag ?? '',
      description: mission.description ?? '',
      images: (mission.images ?? []).map((img) => ({ url: img.url ?? '', alt: img.alt ?? '', order: img.order ?? 0 })),
    });
    setError('');
    setSuccess('');
  };

  const addImage = () => {
    setForm((f) => ({
      ...f,
      images: [...f.images, { url: '', alt: '', order: f.images.length }],
    }));
  };

  const removeImage = (index) => {
    setForm((f) => ({
      ...f,
      images: f.images.filter((_, i) => i !== index).map((img, i) => ({ ...img, order: i })),
    }));
  };

  const updateImage = (index, field, value) => {
    setForm((f) => ({
      ...f,
      images: f.images.map((img, i) => (i === index ? { ...img, [field]: value } : img)),
    }));
  };

  const triggerFileUpload = (index) => {
    setError('');
    setUploadingIndex(index);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target?.files?.[0];
    e.target.value = '';
    const index = uploadingIndex;
    setUploadingIndex(null);
    if (!file || typeof index !== 'number') return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPEG, PNG, GIF, or WebP).');
      return;
    }
    try {
      const { url } = await adminApi.uploadLandingMissionImage(editingId, file);
      updateImage(index, 'url', url);
      setSuccess('Image uploaded.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message || 'Upload failed');
    }
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaveLoading(true);
    setError('');
    setSuccess('');
    try {
      await adminApi.updateLandingMission(editingId, {
        title: form.title,
        tag: form.tag,
        description: form.description,
        images: form.images.filter((img) => img.url.trim()).map((img, i) => ({ url: img.url.trim(), alt: img.alt?.trim() ?? '', order: i })),
      });
      setSuccess('Landing mission updated.');
      await fetchMissions();
      setEditingId(null);
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="font-mono text-[var(--text-muted)]">Loading landing missions…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">Landing page</h1>
        <p className="font-mono text-sm text-[var(--text-muted)] mt-1">
          Update Mission Exploit & Mission Exploit 2.0 photos and info shown on the landing page.
        </p>
      </div>

      {error && (
        <NeonCard glow="red" className="p-4">
          <p className="text-sm text-[var(--neon-red)]">{error}</p>
        </NeonCard>
      )}
      {success && (
        <NeonCard glow="green" className="p-4">
          <p className="text-sm text-[var(--neon-green)]">{success}</p>
        </NeonCard>
      )}

      {!editingId ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MISSION_IDS.map(({ id, label }) => {
            const mission = missions.find((m) => m.id === id) || { id, title: label, tag: 'Coming soon', description: '', images: [] };
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <NeonCard glow="cyan" className="p-5 cursor-pointer hover:border-[var(--neon-cyan)]/50" onClick={() => openEdit(mission)}>
                  <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)] mb-2">{mission.title}</h2>
                  <p className="font-mono text-xs text-[var(--text-muted)] mb-2">{mission.tag} · {(mission.images ?? []).length} photo(s)</p>
                  <p className="font-mono text-xs text-[var(--neon-cyan)]">Click to edit →</p>
                </NeonCard>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <NeonCard glow="cyan" className="p-6">
          <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)] mb-4">Edit {form.title || 'mission'}</h2>
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-xs text-[var(--text-muted)] mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                placeholder="Mission Exploit"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[var(--text-muted)] mb-1">Tag</label>
              <input
                type="text"
                value={form.tag}
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                placeholder="Coming soon"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[var(--text-muted)] mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] resize-y"
                placeholder="Mission description…"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-mono text-xs text-[var(--text-muted)]">Photos (paste URL or upload file)</label>
                <button
                  type="button"
                  onClick={addImage}
                  className="font-mono text-xs text-[var(--neon-cyan)] hover:underline"
                >
                  + Add image
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="space-y-2">
                {form.images.map((img, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    {img.url ? (
                      <img
                        src={img.url}
                        alt={img.alt || ''}
                        className="w-14 h-14 rounded-lg object-cover border border-[var(--border)] flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg border border-dashed border-[var(--border)] flex-shrink-0 flex items-center justify-center font-mono text-[10px] text-[var(--text-dim)]">
                        No img
                      </div>
                    )}
                    <input
                      type="url"
                      value={img.url}
                      onChange={(e) => updateImage(index, 'url', e.target.value)}
                      placeholder="https://… or upload"
                      className="flex-1 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)]"
                    />
                    <input
                      type="text"
                      value={img.alt}
                      onChange={(e) => updateImage(index, 'alt', e.target.value)}
                      placeholder="Alt"
                      className="w-20 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-2 font-mono text-xs text-[var(--text-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => triggerFileUpload(index)}
                      disabled={uploadingIndex !== null}
                      className="px-2 py-2 font-mono text-xs text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/10 rounded-lg border border-[var(--border)]"
                    >
                      {uploadingIndex === index ? '…' : 'Upload'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="p-2 text-[var(--neon-red)] hover:bg-[var(--neon-red)]/10 rounded-lg font-mono text-xs"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {form.images.length === 0 && (
                  <p className="font-mono text-xs text-[var(--text-dim)]">No images. Click &quot;+ Add image&quot; then paste a URL or use Upload.</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-6">
            <AnimatedButton variant="cyan" onClick={handleSave} disabled={saveLoading}>
              {saveLoading ? 'Saving…' : 'Save'}
            </AnimatedButton>
            <AnimatedButton variant="ghost" onClick={() => setEditingId(null)} disabled={saveLoading}>
              Cancel
            </AnimatedButton>
          </div>
        </NeonCard>
      )}
    </div>
  );
}
