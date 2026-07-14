import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsApi } from '../lib/api-helpers';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_DAG = {
  nodes: [
    { id: 'step1', type: 'delay', config: { durationMs: 1000 } },
    { id: 'step2', type: 'http', config: { url: 'https://httpbin.org/get', method: 'GET' } },
  ],
  edges: [{ from: 'step1', to: 'step2' }],
};

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDag, setNewDag] = useState(JSON.stringify(DEFAULT_DAG, null, 2));
  const [newCron, setNewCron] = useState('');
  const [dagError, setDagError] = useState('');
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => workflowsApi.list({ limit: 20 }),
    refetchInterval: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => workflowsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setNewDag(JSON.stringify(DEFAULT_DAG, null, 2)); setNewCron('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setDagError('');
    let parsed: any;
    try {
      parsed = JSON.parse(newDag);
    } catch {
      setDagError('Invalid JSON — please check DAG definition.');
      return;
    }
    createMutation.mutate({
      name: newName,
      description: newDesc,
      definitionJson: parsed,
      cronExpression: newCron || undefined,
    });
  };

  const handleTrigger = async (id: string) => {
    setTriggeringId(id);
    try {
      await workflowsApi.trigger(id);
      queryClient.invalidateQueries({ queryKey: ['runs-recent'] });
    } catch (err) {
      console.error('Trigger failed', err);
    } finally {
      setTriggeringId(null);
    }
  };

  const canEdit = user?.role === 'admin' || user?.role === 'editor';

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Workflows</h1>
          <p className="page-subtitle">Manage your DAG workflow definitions</p>
        </div>
        {canEdit && (
          <button id="btn-create-workflow" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + New Workflow
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="loading-center"><span className="spinner" /></div>
      ) : data?.data?.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>No workflows yet</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 24 }}>
            Create your first workflow to start orchestrating tasks
          </p>
          {canEdit && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Create Workflow
            </button>
          )}
        </div>
      ) : (
        <div className="card-grid">
          {data?.data?.map((wf: any) => (
            <div key={wf.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{wf.name}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {wf.description || 'No description'}
                  </p>
                </div>
                <span className={`badge ${wf.isActive ? 'badge-success' : 'badge-neutral'}`}>
                  {wf.isActive ? 'active' : 'inactive'}
                </span>
              </div>

              {wf.currentVersion && (
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                  v{wf.currentVersion.versionNumber} &bull;{' '}
                  {wf.currentVersion.definitionJson?.nodes?.length ?? 0} steps
                </p>
              )}

              {wf.cronExpression && (
                <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-accent)', marginBottom: 12 }}>
                  ⏰ {wf.cronExpression}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canEdit && (
                  <button
                    id={`btn-trigger-${wf.id}`}
                    className="btn btn-success btn-sm"
                    onClick={() => handleTrigger(wf.id)}
                    disabled={triggeringId === wf.id}
                  >
                    {triggeringId === wf.id ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '▶ Trigger'}
                  </button>
                )}
                {user?.role === 'admin' && (
                  <button
                    id={`btn-delete-${wf.id}`}
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      if (confirm(`Delete "${wf.name}"?`)) deleteMutation.mutate(wf.id);
                    }}
                  >
                    🗑 Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <h2 className="modal-title">New Workflow</h2>
            <form onSubmit={handleCreate} id="create-workflow-form">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input id="wf-name" className="form-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Workflow" required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input id="wf-desc" className="form-input" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optional description" />
              </div>
              <div className="form-group">
                <label className="form-label">Cron Expression (optional)</label>
                <input id="wf-cron" className="form-input" value={newCron} onChange={(e) => setNewCron(e.target.value)} placeholder="*/5 * * * *" />
              </div>
              <div className="form-group">
                <label className="form-label">DAG Definition (JSON) *</label>
                <textarea
                  id="wf-dag"
                  className="form-textarea"
                  style={{ fontFamily: 'monospace', fontSize: 12, minHeight: 160 }}
                  value={newDag}
                  onChange={(e) => setNewDag(e.target.value)}
                  required
                />
                {dagError && <p style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 4 }}>{dagError}</p>}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button id="create-workflow-submit" type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <span className="spinner" /> : 'Create Workflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
