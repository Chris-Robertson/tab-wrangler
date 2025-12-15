import { useState, useEffect } from 'preact/hooks';
import { sendMessage, type ActionResponse, type KeepStrategy } from '@shared/messaging';
import type { SortOrder } from '@shared/types';

interface QuickActionsProps {
  onAction: (action: () => Promise<void>) => Promise<void>;
}

interface Toast {
  message: string;
  type: 'success' | 'info';
}

interface DuplicateConfirmation {
  count: number;
  keepStrategy: KeepStrategy;
}

export function QuickActions({ onAction }: QuickActionsProps) {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [duplicateConfirm, setDuplicateConfirm] = useState<DuplicateConfirmation | null>(null);

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

  // Step 1: Scan for duplicates and show confirmation
  const handleScanDuplicates = async () => {
    const response = await sendMessage<ActionResponse>({ type: 'GET_DUPLICATE_COUNT' });
    if (response.count && response.count > 0) {
      setDuplicateConfirm({ count: response.count, keepStrategy: 'oldest' });
    } else {
      showToast('No duplicates found', 'info');
    }
  };

  // Step 2: Confirm and remove duplicates
  const handleConfirmRemove = () =>
    onAction(async () => {
      if (!duplicateConfirm) return;
      const response = await sendMessage<ActionResponse>({
        type: 'REMOVE_DUPLICATES',
        keepStrategy: duplicateConfirm.keepStrategy,
      });
      setDuplicateConfirm(null);
      if (response.count && response.count > 0) {
        showToast(`✓ Removed ${response.count} duplicate${response.count === 1 ? '' : 's'}`);
      } else {
        showToast('No duplicates found', 'info');
      }
    });

  const handleCancelRemove = () => {
    setDuplicateConfirm(null);
  };

  const handleKeepStrategyChange = (strategy: KeepStrategy) => {
    if (duplicateConfirm) {
      setDuplicateConfirm({ ...duplicateConfirm, keepStrategy: strategy });
    }
  };

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

      {duplicateConfirm && (
        <div class="confirm-dialog">
          <p class="confirm-message">
            Found <strong>{duplicateConfirm.count}</strong> duplicate{duplicateConfirm.count === 1 ? '' : 's'} to remove
          </p>
          <div class="confirm-options">
            <label class="confirm-label">Keep:</label>
            <select
              class="confirm-select"
              value={duplicateConfirm.keepStrategy}
              onChange={(e) => handleKeepStrategyChange((e.target as HTMLSelectElement).value as KeepStrategy)}
            >
              <option value="oldest">Oldest tab</option>
              <option value="newest">Newest tab</option>
            </select>
          </div>
          <div class="confirm-buttons">
            <button class="confirm-btn confirm-btn-primary" onClick={handleConfirmRemove}>
              Remove
            </button>
            <button class="confirm-btn confirm-btn-cancel" onClick={handleCancelRemove}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div class="action-buttons">
        <button class="action-button" onClick={handleScanDuplicates} disabled={!!duplicateConfirm}>
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

