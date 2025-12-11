import type { StatsResponse } from '@shared/messaging';

interface StatsProps {
  stats: StatsResponse;
}

export function Stats({ stats }: StatsProps) {
  return (
    <section class="stats">
      <div class="stat-item">
        <span class="stat-value">{stats.tabCount}</span>
        <span class="stat-label">Tabs</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{stats.groupCount}</span>
        <span class="stat-label">Groups</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{stats.duplicateCount}</span>
        <span class="stat-label">Duplicates</span>
      </div>
    </section>
  );
}

