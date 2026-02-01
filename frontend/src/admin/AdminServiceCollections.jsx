import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NeonCard } from '../components/NeonCard';
import { AnimatedButton } from '../components/AnimatedButton';
import { adminApi } from '../api/client';

const DIFFICULTIES = [
  { value: '', label: 'All' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
];

export default function AdminServiceCollections() {
  const [collections, setCollections] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    difficulty: 'beginner',
    description: '',
    serviceTemplateIds: ['', '', '', '', ''],
    isDefault: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settingDefault, setSettingDefault] = useState(null);

  const fetchCollections = useCallback(async () => {
    try {
      const params = filterDifficulty ? { difficulty: filterDifficulty } : {};
      const data = await adminApi.getServiceCollections(params);
      setCollections(Array.isArray(data) ? data : []);
    } catch (err) {
      setCollections([]);
    }
  }, [filterDifficulty]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await adminApi.getServiceTemplates({});
      setTemplates(res.templates || []);
    } catch (err) {
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCollections(), fetchTemplates()]).finally(() => setLoading(false));
  }, [fetchCollections, fetchTemplates]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const ids = createForm.serviceTemplateIds.filter(Boolean);
    if (ids.length !== 5) {
      setError('You must select exactly 5 service templates.');
      return;
    }
    setSaving(true);
    try {
      await adminApi.createServiceCollection({
        name: createForm.name.trim(),
        difficulty: createForm.difficulty,
        description: createForm.description.trim(),
        serviceTemplateIds: ids,
        isDefault: createForm.isDefault,
      });
      setSuccess('Collection created.');
      setShowCreate(false);
      setCreateForm({ name: '', difficulty: 'beginner', description: '', serviceTemplateIds: ['', '', '', '', ''], isDefault: false });
      await fetchCollections();
    } catch (err) {
      setError(err.message || 'Failed to create collection');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (collectionId) => {
    setError('');
    setSuccess('');
    setSettingDefault(collectionId);
    try {
      await adminApi.setDefaultServiceCollection(collectionId);
      setSuccess('Set as default for this difficulty.');
      await fetchCollections();
    } catch (err) {
      setError(err.message || 'Failed to set default');
    } finally {
      setSettingDefault(null);
    }
  };

  const updateTemplateSlot = (index, templateId) => {
    setCreateForm((f) => ({
      ...f,
      serviceTemplateIds: f.serviceTemplateIds.map((id, i) => (i === index ? templateId : id)),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">Service Collections</h1>
        <div className="flex items-center gap-3">
          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <AnimatedButton variant="cyan" onClick={() => { setShowCreate(true); setError(''); setSuccess(''); }}>
            + Create Collection
          </AnimatedButton>
        </div>
      </div>

      <p className="font-mono text-sm text-[var(--text-muted)]">
        A collection is a set of exactly 5 service templates used when provisioning a match. Set one collection per difficulty as &quot;default&quot; so the match engine knows which set to use.
      </p>

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

      {loading ? (
        <p className="font-mono text-[var(--text-muted)]">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {collections.map((col) => (
            <NeonCard key={col.id} glow={col.isDefault ? 'green' : 'cyan'} className="p-5">
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-lg font-semibold text-[var(--text-primary)]">{col.name}</h3>
                    {col.isDefault && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--neon-green)]/20 text-[var(--neon-green)]">Default</span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-[var(--text-muted)] mt-1">Difficulty: {col.difficulty}</p>
                  {col.description && <p className="font-mono text-xs text-[var(--text-dim)] mt-1">{col.description}</p>}
                  <p className="font-mono text-xs text-[var(--neon-cyan)] mt-2">
                    Templates: {(col.serviceTemplateIds || []).length} selected
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {!col.isDefault && (
                    <AnimatedButton
                      variant="green"
                      onClick={() => handleSetDefault(col.collectionId || col.id)}
                      disabled={settingDefault === (col.collectionId || col.id)}
                    >
                      {settingDefault === (col.collectionId || col.id) ? '…' : 'Set as default'}
                    </AnimatedButton>
                  )}
                </div>
              </div>
            </NeonCard>
          ))}
          {collections.length === 0 && (
            <NeonCard glow="cyan" className="p-8 text-center text-[var(--text-muted)] font-mono">
              No collections yet. Create one with exactly 5 service templates, then set it as default for a difficulty.
            </NeonCard>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="p-6">
              <h2 className="font-heading text-xl font-bold text-[var(--text-primary)] mb-4">Create Service Collection</h2>
              <p className="font-mono text-xs text-[var(--text-muted)] mb-4">Select exactly 5 service templates. This set will be used when provisioning matches for the chosen difficulty.</p>
              {error && <p className="text-sm text-[var(--neon-red)] mb-2">{error}</p>}
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block font-mono text-xs text-[var(--text-muted)] mb-1">Name</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                    placeholder="e.g. Beginner set 1"
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-[var(--text-muted)] mb-1">Difficulty</label>
                  <select
                    value={createForm.difficulty}
                    onChange={(e) => setCreateForm((f) => ({ ...f, difficulty: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                  >
                    {DIFFICULTIES.filter((d) => d.value).map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-xs text-[var(--text-muted)] mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={createForm.description}
                    onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                    placeholder="Short description"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-[var(--text-muted)] mb-2">Select exactly 5 templates</label>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <select
                      key={i}
                      value={createForm.serviceTemplateIds[i] || ''}
                      onChange={(e) => updateTemplateSlot(i, e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] mb-2"
                      required
                    >
                      <option value="">— Select template {i + 1} —</option>
                      {templates.map((t) => (
                        <option key={t.templateId || t.id} value={t.templateId || t.id}>
                          {t.name} ({t.type}, {t.difficulty})
                        </option>
                      ))}
                    </select>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={createForm.isDefault}
                    onChange={(e) => setCreateForm((f) => ({ ...f, isDefault: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="isDefault" className="font-mono text-sm text-[var(--text-primary)]">Set as default for this difficulty</label>
                </div>
                <div className="flex gap-3 pt-2">
                  <AnimatedButton type="submit" variant="green" disabled={saving}>
                    {saving ? 'Creating…' : 'Create'}
                  </AnimatedButton>
                  <AnimatedButton type="button" variant="ghost" onClick={() => setShowCreate(false)} disabled={saving}>
                    Cancel
                  </AnimatedButton>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
