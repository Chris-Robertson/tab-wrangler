import { useState, useEffect } from 'preact/hooks';
import { sendMessage, type ActionResponse } from '@shared/messaging';
import type { ClosedTabEntry } from '@shared/types';
import { formatRelativeTime } from '@shared/utils';

interface RecentlyClosedProps {
  onUndo: () => void;
}

export function RecentlyClosed({ onUndo }: RecentlyClosedProps) {
  const [entries, setEntries] = useState<ClosedTabEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.storage.local.get('recentlyClosed', (result) => {
      if (result.recentlyClosed) {
        // Show only the most recent 5 entries
        setEntries(result.recentlyClosed.slice(0, 5));
      }
      setLoading(false);
    });
  }, []);

  const handleUndo = async (entryId: string) => {
    const response = await sendMessage<ActionResponse>({
      type: 'UNDO_CLOSE',
      entryId,
    });

    if (response.success) {
      setEntries(entries.filter((e) => e.id !== entryId));
      onUndo();
    }
  };

  if (loading || entries.length === 0) {
    return null;
  }

  return (
    <section class="recently-closed">
      <h2>Recently Closed</h2>

      <ul class="closed-list">
        {entries.map((entry) => (
          <li key={entry.id} class="closed-item">
            <div class="closed-info">
              <span class="closed-title" title={entry.url}>
                {entry.title || entry.url}
              </span>
              <span class="closed-time">
                {formatRelativeTime(entry.closedAt)}
              </span>
            </div>
            <button
              class="undo-button"
              onClick={() => handleUndo(entry.id)}
              title="Reopen tab"
            >
              Undo
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

