import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { runsApi } from '../lib/api-helpers';
import DagCanvas from '../components/DagCanvas';

export default function RunsPage() {
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['runs', cursor, statusFilter],
    queryFn: () => runsApi.list({ cursor, limit: 20, status: statusFilter || undefined }),
    refetchInterval: 5_000,
  });

  const { data: runLogs } = useQuery({
    queryKey: ['run-logs', selectedRun?.id],
    queryFn: () => runsApi.getLogs(selectedRun.id),
    enabled: !!selectedRun,
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
        <h1 className="page-title">Run History</h1>
        <p className="page-subtitle">View workflow execution history and logs</p>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Run List */}
        <div style={{ flex: '0 0 440px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <select
              className="form-select"
              style={{ flex: 1 }}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCursor(undefined); }}
              id="runs-status-filter"
            >
              <option value="">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="timed_out">Timed Out</option>
            </select>
          </div>

          {isLoading ? (
            <div className="loading-center"><span className="spinner" /></div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Run ID</th>
                    <th>Status</th>
                    <th>Trigger</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data?.map((run: any) => (
                    <tr
                      key={run.id}
                      onClick={() => setSelectedRun(run)}
                      style={{ cursor: 'pointer', background: selectedRun?.id === run.id ? 'rgba(99,102,241,0.1)' : undefined }}
                      id={`run-row-${run.id}`}
                    >
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{run.id.slice(0, 8)}...</td>
                      <td><span className={`badge ${statusBadge(run.status)}`}>{run.status}</span></td>
                      <td><span className="badge badge-neutral">{run.triggerType}</span></td>
                      <td style={{ fontSize: 12 }}>{new Date(run.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data?.nextCursor && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => setCursor(data.nextCursor)}
            >
              Load More
            </button>
          )}
        </div>

        {/* Run Detail */}
        <div style={{ flex: 1 }}>
          {selectedRun ? (
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>
                  Run Detail
                  <span className={`badge ${statusBadge(selectedRun.status)}`} style={{ marginLeft: 8 }}>
                    {selectedRun.status}
                  </span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Run ID: </span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{selectedRun.id}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Trigger: </span>
                    {selectedRun.triggerType}
                  </div>
                  {selectedRun.startedAt && (
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Started: </span>
                      {new Date(selectedRun.startedAt).toLocaleString()}
                    </div>
                  )}
                  {selectedRun.completedAt && (
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Completed: </span>
                      {new Date(selectedRun.completedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              {/* DAG Visualization for this run */}
              <div className="card" style={{ height: 320, padding: 0, overflow: 'hidden' }}>
                <DagCanvas workflowId={selectedRun.workflowId} runId={selectedRun.id} />
              </div>

              {/* Execution Logs */}
              {runLogs && runLogs.length > 0 && (
                <div className="card" style={{ marginTop: 16 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Execution Logs</h4>
                  <div style={{ maxHeight: 240, overflow: 'auto' }}>
                    {runLogs.map((log: any, i: number) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 12,
                          fontFamily: 'monospace',
                          padding: '4px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          color: log.level === 'error' ? '#ef4444' : log.level === 'warn' ? '#f59e0b' : '#94a3b8',
                        }}
                      >
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          [{new Date(log.timestamp).toLocaleTimeString()}]
                        </span>
                        {' '}
                        <span style={{ color: '#6366f1' }}>[{log.stepKey}]</span>
                        {' '}{log.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                Select a run to view details and DAG visualization
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
