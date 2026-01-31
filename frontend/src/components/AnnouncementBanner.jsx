import { useState, useEffect } from 'react';
import { api } from '../api/client';

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.getAnnouncement().then(setAnnouncement).catch(() => setAnnouncement({ text: '', enabled: false }));
  }, []);

  if (!announcement?.enabled || !announcement?.text?.trim() || dismissed) return null;

  return (
    <div className="bg-[var(--neon-amber)]/15 border-b border-[var(--neon-amber)]/50 text-[var(--text-primary)] px-4 py-2 flex items-center justify-center gap-4 text-sm font-mono">
      <span className="flex-1 text-center">{announcement.text}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
