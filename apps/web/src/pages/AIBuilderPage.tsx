import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { aiApi, workflowsApi } from '../lib/api-helpers';
import { useAuth } from '../contexts/AuthContext';

export default function AIBuilderPage() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [generatedDag, setGeneratedDag] = useState<any>(null);
  const [dagJson, setDagJson] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () => aiApi.generateWorkflow(prompt),
    onSuccess: (data) => {
      setGeneratedDag(data);
      setDagJson(JSON.stringify(data, null, 2));
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      let parsed: any;
      try { parsed = JSON.parse(dagJson); } catch { throw new Error('Invalid JSON'); }
      return workflowsApi.create({
        name: workflowName || 'AI Generated Workflow',
        description: `Generated from: "${prompt}"`,
        definitionJson: parsed,
      });
    },
    onSuccess: () => {
      setSaveSuccess(true);
      setShowSaveForm(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const canUse = user?.role === 'admin' || user?.role === 'editor';

  if (!canUse) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>
          AI Builder requires Admin or Editor role.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🤖 AI Workflow Builder</h1>
        <p className="page-subtitle">
          Describe a workflow in natural language — powered by Google Gemini
        </p>
      </div>

      {saveSuccess && (
        <div style={{
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 8,
          padding: '12px 16px',
          color: '#10b981',
          fontSize: 14,
          marginBottom: 16,
        }}>
          ✅ Workflow saved successfully! Go to Workflows to trigger it.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Input Panel */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
              Describe Your Workflow
            </h3>
            <div className="form-group">
              <label className="form-label">Natural Language Prompt</label>
              <textarea
                id="ai-prompt"
                className="form-textarea"
                style={{ minHeight: 140 }}
                placeholder={`Example:\n"Delay 2 seconds, then fetch data from https://api.example.com/users, then check if the response status is 200. If yes, send a POST to https://notify.example.com/success."`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                Max ~500 words. Be specific about step types (http, delay, condition, script).
              </p>
            </div>
            <button
              id="btn-generate-dag"
              className="btn btn-primary"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || !prompt.trim()}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {generateMutation.isPending ? (
                <><span className="spinner" /> Generating...</>
              ) : (
                '✨ Generate DAG'
              )}
            </button>

            {generateMutation.isError && (
              <div style={{
                marginTop: 12,
                padding: '10px 12px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8,
                color: '#ef4444',
                fontSize: 13,
              }}>
                ⚠️ {(generateMutation.error as any)?.response?.data?.message || 'Generation failed. Try a more specific description.'}
              </div>
            )}
          </div>

          {/* Example Prompts */}
          <div className="card">
            <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)' }}>
              EXAMPLE PROMPTS
            </h4>
            {[
              'Wait 3 seconds, then fetch user data from https://jsonplaceholder.typicode.com/users',
              'Fetch weather data from an API, check if temperature > 30, and send a notification if hot',
              'Run 3 parallel HTTP requests to different APIs, then combine results with a script step',
            ].map((ex, i) => (
              <button
                key={i}
                className="btn btn-secondary btn-sm"
                style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 8, whiteSpace: 'normal', height: 'auto', padding: '8px 12px' }}
                onClick={() => setPrompt(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Output Panel */}
        <div>
          {generatedDag ? (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Generated DAG</h3>
                <span className="badge badge-success">
                  {generatedDag.nodes?.length ?? 0} steps
                </span>
              </div>

              {/* Node Summary */}
              <div style={{ marginBottom: 16 }}>
                {generatedDag.nodes?.map((n: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 6,
                      marginBottom: 6,
                      fontSize: 13,
                    }}
                  >
                    <span style={{
                      background: 'var(--color-primary-glow)',
                      color: 'var(--color-primary)',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      {n.type}
                    </span>
                    <span style={{ fontWeight: 600 }}>{n.id}</span>
                    {n.config?.url && (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.config.url}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Editable JSON */}
              <div className="form-group">
                <label className="form-label">Edit DAG JSON (optional)</label>
                <textarea
                  id="ai-dag-output"
                  className="form-textarea"
                  style={{ fontFamily: 'monospace', fontSize: 11, minHeight: 180 }}
                  value={dagJson}
                  onChange={(e) => setDagJson(e.target.value)}
                />
              </div>

              {!showSaveForm ? (
                <button
                  id="btn-save-ai-workflow"
                  className="btn btn-success"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setShowSaveForm(true)}
                >
                  💾 Save as Workflow
                </button>
              ) : (
                <div>
                  <div className="form-group">
                    <label className="form-label">Workflow Name</label>
                    <input
                      id="ai-workflow-name"
                      className="form-input"
                      value={workflowName}
                      onChange={(e) => setWorkflowName(e.target.value)}
                      placeholder="AI Generated Workflow"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowSaveForm(false)}>
                      Cancel
                    </button>
                    <button
                      id="btn-confirm-save-workflow"
                      className="btn btn-success"
                      style={{ flex: 1 }}
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                    >
                      {saveMutation.isPending ? <span className="spinner" /> : 'Confirm Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{
              height: '100%',
              minHeight: 400,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
            }}>
              <div style={{ fontSize: 48 }}>🤖</div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, textAlign: 'center', maxWidth: 280 }}>
                Enter a natural language description and click Generate to create a workflow DAG automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
