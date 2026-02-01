import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NeonCard } from '../components/NeonCard';
import { AnimatedButton } from '../components/AnimatedButton';
import { adminApi } from '../api/client';

const TYPES = [
  { value: '', label: 'All Types' },
  { value: 'web', label: 'Web' },
  { value: 'ssh', label: 'SSH' },
  { value: 'database', label: 'Database' },
  { value: 'api', label: 'API' },
  { value: 'other', label: 'Other' },
];
const DIFFICULTIES = [
  { value: '', label: 'All Difficulties' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
];

const defaultForm = () => ({
  name: '',
  type: 'web',
  difficulty: 'beginner',
  dockerImage: '',
  dockerfile: '',
  port: 80,
  environmentVars: {},
  flagPath: '/flag.txt',
  vulnerabilities: [],
  healthCheck: { type: 'http', endpoint: '/', expectedStatus: 200, interval: 30 },
});

function TemplateCard({ template, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!window.confirm(`Delete template "${template.name}"? This will soft-deactivate it.`)) return;
    setDeleting(true);
    try {
      await adminApi.deleteServiceTemplate(template.templateId || template.id);
      onDelete?.();
    } catch (err) {
      alert(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <NeonCard glow="cyan" className="p-5">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-semibold text-[var(--text-primary)]">{template.name}</h3>
          <div className="flex flex-wrap gap-3 mt-2 font-mono text-xs text-[var(--text-muted)]">
            <span>Type: {template.type}</span>
            <span>Difficulty: {template.difficulty}</span>
            <span>Port: {template.port}</span>
          </div>
          <p className="mt-2 font-mono text-xs text-[var(--neon-cyan)]">Docker: {template.dockerImage}</p>
          <p className="font-mono text-xs text-[var(--text-muted)]">Flag path: {template.flagPath}</p>
          {Array.isArray(template.vulnerabilities) && template.vulnerabilities.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-[var(--text-primary)]">Vulnerabilities:</p>
              <ul className="list-disc list-inside text-xs text-[var(--text-muted)]">
                {template.vulnerabilities.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <AnimatedButton variant="cyan" onClick={() => onEdit?.(template)}>
            Edit
          </AnimatedButton>
          <AnimatedButton variant="red" onClick={handleDelete} disabled={deleting}>
            {deleting ? '…' : 'Delete'}
          </AnimatedButton>
        </div>
      </div>
      <p className="mt-3 font-mono text-xs text-[var(--text-dim)]">Used in {template.usageCount ?? 0} matches</p>
    </NeonCard>
  );
}

function TemplateModal({ template, onClose, onSuccess }) {
  const isEdit = !!template;
  const [formData, setFormData] = useState(isEdit ? { ...defaultForm(), ...template } : defaultForm());
  const [useDockerfile, setUseDockerfile] = useState(!!(template?.dockerfile));
  const [vulnerabilityInput, setVulnerabilityInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    setError('');
    try {
      const form = new FormData();
      form.append('dockerfile', file);
      const res = await adminApi.uploadDockerfile(form);
      setFormData((prev) => ({ ...prev, dockerfile: res.dockerfile }));
    } catch (err) {
      setError(err.message || 'Upload failed');
    }
    e.target.value = '';
  };

  const addVulnerability = () => {
    if (vulnerabilityInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        vulnerabilities: [...(prev.vulnerabilities || []), vulnerabilityInput.trim()],
      }));
      setVulnerabilityInput('');
    }
  };

  const removeVulnerability = (index) => {
    setFormData((prev) => ({
      ...prev,
      vulnerabilities: prev.vulnerabilities.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
        difficulty: formData.difficulty,
        port: Number(formData.port) || 80,
        flagPath: formData.flagPath?.trim() || '/flag.txt',
        vulnerabilities: formData.vulnerabilities || [],
        healthCheck: formData.healthCheck || { type: 'http', endpoint: '/', expectedStatus: 200, interval: 30 },
        environmentVars: formData.environmentVars && typeof formData.environmentVars === 'object' ? formData.environmentVars : {},
      };
      if (!useDockerfile) payload.dockerImage = formData.dockerImage?.trim() || '';
      else if (formData.dockerfile) payload.dockerfile = formData.dockerfile;

      if (isEdit) {
        await adminApi.updateServiceTemplate(template.templateId || template.id, payload);
      } else {
        await adminApi.createServiceTemplate(payload);
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
      >
        <div className="p-6">
          <h2 className="font-heading text-xl font-bold text-[var(--text-primary)] mb-4">
            {isEdit ? 'Edit' : 'Create'} Service Template
          </h2>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--neon-red)]/10 border border-[var(--neon-red)]/50 text-sm text-[var(--neon-red)]">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-xs text-[var(--text-muted)] mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs text-[var(--text-muted)] mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                >
                  {TYPES.filter((t) => t.value).map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-xs text-[var(--text-muted)] mb-1">Difficulty</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData((f) => ({ ...f, difficulty: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                >
                  {DIFFICULTIES.filter((d) => d.value).map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block font-mono text-xs text-[var(--text-muted)] mb-2">Docker Source</label>
              <div className="flex gap-4 mb-2">
                <label className="flex items-center gap-2 font-mono text-sm text-[var(--text-primary)]">
                  <input
                    type="radio"
                    checked={!useDockerfile}
                    onChange={() => setUseDockerfile(false)}
                    className="rounded"
                  />
                  Use existing image
                </label>
                <label className="flex items-center gap-2 font-mono text-sm text-[var(--text-primary)]">
                  <input
                    type="radio"
                    checked={useDockerfile}
                    onChange={() => setUseDockerfile(true)}
                    className="rounded"
                  />
                  Upload Dockerfile
                </label>
              </div>
              {!useDockerfile ? (
                <input
                  type="text"
                  placeholder="e.g. nginx:latest or ctf/vuln-web:1.0"
                  value={formData.dockerImage}
                  onChange={(e) => setFormData((f) => ({ ...f, dockerImage: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                  required={!useDockerfile}
                />
              ) : (
                <input
                  type="file"
                  accept=".dockerfile,Dockerfile,*"
                  onChange={handleFileUpload}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs text-[var(--text-muted)] mb-1">Port</label>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={formData.port}
                  onChange={(e) => setFormData((f) => ({ ...f, port: parseInt(e.target.value, 10) || 80 }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                  required
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-[var(--text-muted)] mb-1">Flag path in container</label>
                <input
                  type="text"
                  placeholder="/var/www/html/flag.txt"
                  value={formData.flagPath}
                  onChange={(e) => setFormData((f) => ({ ...f, flagPath: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block font-mono text-xs text-[var(--text-muted)] mb-1">Vulnerabilities</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="e.g. SQL Injection in login"
                  value={vulnerabilityInput}
                  onChange={(e) => setVulnerabilityInput(e.target.value)}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
                />
                <AnimatedButton type="button" variant="cyan" onClick={addVulnerability}>
                  Add
                </AnimatedButton>
              </div>
              <ul className="space-y-1 text-sm text-[var(--text-muted)]">
                {(formData.vulnerabilities || []).map((v, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded bg-[var(--bg-primary)]/50 px-2 py-1">
                    <span className="font-mono text-xs">{v}</span>
                    <button type="button" onClick={() => removeVulnerability(i)} className="text-[var(--neon-red)] font-mono text-sm hover:bg-[var(--neon-red)]/10 rounded px-1" aria-label="Remove">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-3 pt-4">
              <AnimatedButton type="submit" variant="green" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
              </AnimatedButton>
              <AnimatedButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
                Cancel
              </AnimatedButton>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function AdminServiceTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', difficulty: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.type) params.type = filter.type;
      if (filter.difficulty) params.difficulty = filter.difficulty;
      const res = await adminApi.getServiceTemplates(params);
      setTemplates(res.templates || []);
    } catch (err) {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [filter.type, filter.difficulty]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">Service Templates</h1>
        <AnimatedButton variant="cyan" onClick={() => { setShowCreateModal(true); setEditingTemplate(null); }}>
          + Create Template
        </AnimatedButton>
      </div>
      <div className="flex flex-wrap gap-4">
        <select
          value={filter.type}
          onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={filter.difficulty}
          onChange={(e) => setFilter((f) => ({ ...f, difficulty: e.target.value }))}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
        >
          {DIFFICULTIES.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <p className="font-mono text-[var(--text-muted)]">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {templates.map((t) => (
            <TemplateCard
              key={t.templateId || t.id}
              template={t}
              onEdit={setEditingTemplate}
              onDelete={fetchTemplates}
            />
          ))}
          {templates.length === 0 && (
            <NeonCard glow="cyan" className="p-8 text-center text-[var(--text-muted)] font-mono">
              No templates. Create one or adjust filters.
            </NeonCard>
          )}
        </div>
      )}
      {showCreateModal && (
        <TemplateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { fetchTemplates(); setShowCreateModal(false); }}
        />
      )}
      {editingTemplate && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSuccess={() => { fetchTemplates(); setEditingTemplate(null); }}
        />
      )}
    </div>
  );
}
