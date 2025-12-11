import { useState, useEffect } from 'preact/hooks';
import { sendMessage, type StatsResponse } from '@shared/messaging';
import { Stats } from './components/Stats';
import { QuickActions } from './components/QuickActions';
import { Toggles } from './components/Toggles';
import { RecentlyClosed } from './components/RecentlyClosed';

export function App() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      const response = await sendMessage<StatsResponse>({ type: 'GET_STATS' });
      setStats(response);
      setError(null);
    } catch (err) {
      setError('Failed to load stats');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleAction = async (action: () => Promise<void>) => {
    try {
      await action();
      await loadStats(); // Refresh stats after action
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  if (loading) {
    return (
      <div class="popup">
        <div class="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="popup">
        <div class="error">{error}</div>
      </div>
    );
  }

  return (
    <div class="popup">
      <header class="popup-header">
        <h1>Tab Wrangler</h1>
      </header>

      <main class="popup-content">
        {stats && <Stats stats={stats} />}

        <QuickActions onAction={handleAction} />

        <Toggles />

        <RecentlyClosed onUndo={loadStats} />
      </main>

      <footer class="popup-footer">
        <button
          class="link-button"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Settings
        </button>
      </footer>
    </div>
  );
}

