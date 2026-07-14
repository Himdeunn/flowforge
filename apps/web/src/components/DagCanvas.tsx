import { useQuery } from '@tanstack/react-query';
import { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { workflowsApi } from '../lib/api-helpers';
import { subscribeToRun } from '../lib/socket';

interface Props {
  workflowId: string;
  runId?: string;
}

function dagToFlow(definition: any) {
  if (!definition) return { nodes: [], edges: [] };

  const nodes: Node[] = (definition.nodes || []).map((n: any, i: number) => ({
    id: n.id,
    type: 'default',
    position: { x: 150 + (i % 4) * 200, y: Math.floor(i / 4) * 120 + 50 },
    data: {
      label: (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{n.id}</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>{n.type}</div>
        </div>
      ),
    },
    className: '',
  }));

  const edges: Edge[] = (definition.edges || []).map((e: any, i: number) => ({
    id: `e-${i}-${e.from}-${e.to}`,
    source: e.from,
    target: e.to,
    label: e.conditionValue !== undefined ? String(e.conditionValue) : undefined,
    style: { stroke: 'rgba(255,255,255,0.15)' },
  }));

  return { nodes, edges };
}

export default function DagCanvas({ workflowId, runId }: Props) {
  const [stepStatuses, setStepStatuses] = useState<Record<string, string>>({});

  const { data: workflow } = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => workflowsApi.get(workflowId),
    enabled: !!workflowId,
  });

  const definition = workflow?.currentVersion?.definitionJson;
  const { nodes: initNodes, edges: initEdges } = dagToFlow(definition);

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  useEffect(() => {
    if (!definition) return;
    const { nodes: n, edges: e } = dagToFlow(definition);
    setNodes(n);
    setEdges(e);
  }, [definition]);

  // Color nodes by step status
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        className: stepStatuses[node.id] || '',
      })),
    );
  }, [stepStatuses]);

  // Subscribe to real-time step updates
  useEffect(() => {
    if (!runId) return;
    const unsubscribe = subscribeToRun(
      runId,
      (data: any) => {
        setStepStatuses((prev) => ({ ...prev, [data.stepKey]: data.status }));
      },
      () => {},
    );
    return unsubscribe;
  }, [runId]);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  if (!workflowId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
        Select a workflow to view its DAG
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        fitViewOptions={{ padding: 0.3 }}
      >
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const s = stepStatuses[n.id];
            if (s === 'running') return '#f59e0b';
            if (s === 'success') return '#10b981';
            if (s === 'failed') return '#ef4444';
            return '#1a2235';
          }}
          style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)' }}
        />
        <Background color="rgba(255,255,255,0.03)" gap={20} />
      </ReactFlow>
    </div>
  );
}
