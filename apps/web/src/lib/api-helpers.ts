import { apiClient } from '../lib/api';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  cronExpression?: string;
  webhookToken?: string;
  currentVersionId?: string;
  currentVersion?: {
    id: string;
    versionNumber: number;
    definitionJson: any;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timed_out';
  triggerType: 'manual' | 'cron' | 'webhook';
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface HealthSummary {
  activeRuns: number;
  successRate: number;
  avgDurationMs: number;
  totalRuns: number;
}

// Workflows
export const workflowsApi = {
  list: (params?: { cursor?: string; limit?: number }) =>
    apiClient.get('/workflows', { params }).then((r) => r.data),
  create: (data: { name: string; description?: string; definitionJson: any; cronExpression?: string }) =>
    apiClient.post('/workflows', data).then((r) => r.data),
  get: (id: string) => apiClient.get(`/workflows/${id}`).then((r) => r.data),
  update: (id: string, data: Partial<{ name: string; description: string; definitionJson: any }>) =>
    apiClient.put(`/workflows/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/workflows/${id}`).then((r) => r.data),
  trigger: (id: string) => apiClient.post(`/workflows/${id}/trigger`).then((r) => r.data),
  getVersions: (id: string) => apiClient.get(`/workflows/${id}/versions`).then((r) => r.data),
  rollback: (id: string, versionId: string) =>
    apiClient.post(`/workflows/${id}/versions/${versionId}/rollback`).then((r) => r.data),
};

// Runs
export const runsApi = {
  list: (params?: { cursor?: string; limit?: number; status?: string }) =>
    apiClient.get('/runs', { params }).then((r) => r.data),
  get: (id: string) => apiClient.get(`/runs/${id}`).then((r) => r.data),
  getLogs: (id: string) => apiClient.get(`/runs/${id}/logs`).then((r) => r.data),
  getHealthSummary: () => apiClient.get('/runs/health-summary').then((r) => r.data),
};

// AI
export const aiApi = {
  generateWorkflow: (prompt: string, currentDefinition?: any) =>
    apiClient.post('/ai/generate-workflow', { prompt, currentDefinition }).then((r) => r.data),
};

// Users
export const usersApi = {
  list: () => apiClient.get('/users').then((r) => r.data),
  create: (data: any) => apiClient.post('/users', data).then((r) => r.data),
  update: (id: string, data: any) => apiClient.put(`/users/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/users/${id}`).then((r) => r.data),
};
