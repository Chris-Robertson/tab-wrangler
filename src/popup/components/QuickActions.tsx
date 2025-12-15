import { useState, useEffect } from 'preact/hooks';
import { sendMessage, type ActionResponse } from '@shared/messaging';
import type { SortOrder } from '@shared/types';

interface QuickActionsProps {
  onAction: (action: () => Promise<void>) => Promise<void>;
}

interface Toast {
  message: string;
  type: 'success' | 'info';
}

export function QuickActions({ onAction }: QuickActionsProps) {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
  };

  const handleRemoveDuplicates = () =>
    onAction(async () => {
      const response = await sendMessage<ActionResponse>({
        type: 'REMOVE_DUPLICATES',
      });
      if (response.count && response.count > 0) {
        showToast(`✓ Removed ${response.count} duplicate${response.count === 1 ? '' : 's'}`);
      } else {
        showToast('No duplicates found', 'info');
      }
    });

  const handleOrganizeAll = () =>
    onAction(async () => {
      const response = await sendMessage<ActionResponse>({
        type: 'ORGANIZE_ALL_TABS',
      });
      if (response.count) {
        console.log(`Organized ${response.count} tabs`);
      }
    });

  const handleSort = (sortOrder: SortOrder) => {
    setShowSortMenu(false);
    onAction(async () => {
      await sendMessage<ActionResponse>({ type: 'SORT_TABS', sortOrder });
    });
  };

  return (
    <section class="quick-actions">
      <h2>Quick Actions</h2>

      {toast && (
        <div class={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      <div class="action-buttons">
        <button class="action-button" onClick={handleRemoveDuplicates}>
          Remove Duplicates
        </button>

        <button class="action-button" onClick={handleOrganizeAll}>
          Organize All
        </button>

        <div class="sort-dropdown">
          <button
            class="action-button"
            onClick={() => setShowSortMenu(!showSortMenu)}
          >
            Sort Tabs ▾
          </button>

          {showSortMenu && (
            <div class="sort-menu">
              <button onClick={() => handleSort('domain')}>By Domain</button>
              <button onClick={() => handleSort('url')}>By URL</button>
              <button onClick={() => handleSort('title')}>By Title</button>
              <button onClick={() => handleSort('ageOldest')}>
                By Age (Oldest)
              </button>
              <button onClick={() => handleSort('ageNewest')}>
                By Age (Newest)
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

