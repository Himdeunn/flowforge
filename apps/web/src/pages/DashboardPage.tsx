import { useQuery } from '@tanstack/react-query';
import { runsApi } from '../lib/api-helpers';

export default function DashboardPage() {
  const { data: health, isLoading } = useQuery({
    queryKey: ['health-summary'],
    queryFn: runsApi.getHealthSummary,
    refetchInterval: 30_000,
    retry: 1,
  });

  const { data: recentRuns } = useQuery({
    queryKey: ['runs-recent'],
    queryFn: () => runsApi.list({ limit: 5 }),
    refetchInterval: 10_000,
    retry: 1,
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: 'badge-success',
      failed: 'badge-danger',
      running: 'badge-warning',
      queued: 'badge-primary',
      timed_out: 'badge-neutral',
    };
    return map[status] || 'badge-neutral';
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">System health overview — last 24 hours</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <p className="stat-value">{isLoading ? '—' : (health?.activeRuns ?? 0)}</p>
          <p className="stat-label">Active Runs</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">
            {isLoading ? '—' : `${((health?.successRate ?? 0) * 100).toFixed(1)}%`}
          </p>
          <p className="stat-label">Success Rate</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">
            {isLoading ? '—' : `${((health?.avgDurationMs ?? 0) / 1000).toFixed(1)}s`}
          </p>
          <p className="stat-label">Avg Duration</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{isLoading ? '—' : (health?.totalRuns ?? 0)}</p>
          <p className="stat-label">Total Runs (24h)</p>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--color-text)' }}>
          Recent Runs
        </h2>
        {recentRuns?.data?.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No runs yet. Create a workflow and trigger it.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Status</th>
                  <th>Trigger</th>
                  <th>Started</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns?.data?.map((run: any) => {
                  const duration = run.completedAt && run.startedAt
                    ? ((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1) + 's'
                    : '—';
                  return (
                    <tr key={run.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{run.id.slice(0, 8)}...</td>
                      <td><span className={`badge ${statusBadge(run.status)}`}>{run.status}</span></td>
                      <td><span className="badge badge-neutral">{run.triggerType}</span></td>
                      <td>{run.startedAt ? new Date(run.startedAt).toLocaleTimeString() : '—'}</td>
                      <td>{duration}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
