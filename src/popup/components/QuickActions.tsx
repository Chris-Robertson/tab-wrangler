import { useState, useEffect } from 'preact/hooks';
import { sendMessage, type ActionResponse, type KeepStrategy } from '@shared/messaging';
import type { SortOrder } from '@shared/types';
import { useHasGroupingRules } from '../hooks/useHasGroupingRules';

interface QuickActionsProps {
  onAction: (action: () => Promise<void>) => Promise<void>;
  isLoading?: boolean;
}

interface Toast {
  message: string;
  type: 'success' | 'info' | 'error';
}

interface DuplicateConfirmation {
  count: number;
  keepStrategy: KeepStrategy;
}

export function QuickActions({ onAction, isLoading = false }: QuickActionsProps) {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [duplicateConfirm, setDuplicateConfirm] = useState<DuplicateConfirmation | null>(null);
  const { hasRules, loading: rulesLoading } = useHasGroupingRules();

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const dismissToast = () => {
    setToast(null);
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
      
      // AC5: Show summary for partial success + errors as warning
      if (response.tabsOrganized && response.tabsOrganized > 0) {
        const groupsCount = response.groupsAffected || 0;
        const groupText = groupsCount === 1 ? 'group' : 'groups';
        
        // AC5: If some tabs failed, show "X tabs organized, Y failed" format
        if (response.tabsFailed && response.tabsFailed > 0) {
          const summaryMsg = `${response.tabsOrganized} tabs organized, ${response.tabsFailed} failed`;
          const errorMsg = response.errors && response.errors.length > 0 ? response.errors[0] : 'Some tabs could not be organized';
          showToast(`✓ ${summaryMsg}\n⚠ ${errorMsg}`, 'error');
        } else if (response.errors && response.errors.length > 0) {
          // Partial success without failed count: show summary + warning about errors
          const summaryMsg = `✓ ${response.tabsOrganized} tabs organized into ${groupsCount} ${groupText}`;
          const errorMsg = response.errors[0];
          showToast(`${summaryMsg}\n⚠ Warning: ${errorMsg}`, 'error');
        } else {
          // Full success
          showToast(`✓ ${response.tabsOrganized} tabs organized into ${groupsCount} ${groupText}`);
        }
      } else if (response.errors && response.errors.length > 0) {
        // Complete failure: show error only
        const errorMsg = response.errors[0];
        showToast(`⚠ ${errorMsg}`, 'error');
      } else {
        // No-op case
        showToast('No tabs organized', 'info');
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
          <span>{toast.message}</span>
          <button class="toast-close" onClick={dismissToast} aria-label="Dismiss">
            ✕
          </button>
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
        <button class="action-button" onClick={handleScanDuplicates} disabled={!!duplicateConfirm || isLoading}>
          Remove Duplicates
        </button>

        <button 
          class="action-button" 
          onClick={handleOrganizeAll}
          disabled={!hasRules || rulesLoading || isLoading}
          title={!hasRules && !rulesLoading ? 'No grouping rules defined. Create rules in the Options page.' : ''}
        >
          Organize All Tabs
        </button>

        <div class="sort-dropdown">
          <button
            class="action-button"
            onClick={() => setShowSortMenu(!showSortMenu)}
            disabled={isLoading}
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

