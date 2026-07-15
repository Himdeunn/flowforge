export interface DagNode {
  id: string;
  type: 'http' | 'script' | 'delay' | 'condition';
  config: Record<string, any>;
}

export interface DagEdge {
  from: string;
  to: string;
}

export interface DagDefinition {
  nodes: DagNode[];
  edges: DagEdge[];
}

export class DagValidationError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'DagValidationError';
  }
}

export function parseAndValidateDag(definition: any): DagDefinition {
  if (!definition || typeof definition !== 'object') {
    throw new DagValidationError(
      'Definition must be an object',
      'INVALID_FORMAT',
    );
  }

  const { nodes, edges } = definition;

  if (!Array.isArray(nodes)) {
    throw new DagValidationError(
      'Definition must contain a nodes array',
      'INVALID_NODES',
    );
  }

  if (!Array.isArray(edges)) {
    throw new DagValidationError(
      'Definition must contain an edges array',
      'INVALID_EDGES',
    );
  }

  // 1. Validate Node properties & unique IDs
  const nodeIds = new Set<string>();
  const validTypes = ['http', 'script', 'delay', 'condition'];

  for (const node of nodes) {
    if (!node || typeof node !== 'object') {
      throw new DagValidationError(
        'Each node must be an object',
        'INVALID_NODE',
      );
    }
    if (typeof node.id !== 'string' || !node.id.trim()) {
      throw new DagValidationError(
        'Node must have a valid string id',
        'INVALID_NODE_ID',
      );
    }
    if (nodeIds.has(node.id)) {
      throw new DagValidationError(
        `Duplicate node id found: ${node.id}`,
        'DUPLICATE_NODE_ID',
      );
    }
    if (!validTypes.includes(node.type)) {
      throw new DagValidationError(
        `Unknown step type: ${node.type} for node ${node.id}`,
        'UNKNOWN_STEP_TYPE',
      );
    }
    if (!node.config || typeof node.config !== 'object') {
      throw new DagValidationError(
        `Node ${node.id} must have a config object`,
        'INVALID_NODE_CONFIG',
      );
    }
    nodeIds.add(node.id);
  }

  // 2. Validate Edges
  for (const edge of edges) {
    if (!edge || typeof edge !== 'object') {
      throw new DagValidationError(
        'Each edge must be an object',
        'INVALID_EDGE',
      );
    }
    if (typeof edge.from !== 'string' || typeof edge.to !== 'string') {
      throw new DagValidationError(
        'Edge must have from and to fields as strings',
        'INVALID_EDGE_FIELDS',
      );
    }
    if (!nodeIds.has(edge.from)) {
      throw new DagValidationError(
        `Edge references non-existent origin node: ${edge.from}`,
        'INVALID_EDGE_ORIGIN',
      );
    }
    if (!nodeIds.has(edge.to)) {
      throw new DagValidationError(
        `Edge references non-existent destination node: ${edge.to}`,
        'INVALID_EDGE_DESTINATION',
      );
    }
    if (edge.from === edge.to) {
      throw new DagValidationError(
        `Self-loop detected on node: ${edge.from}`,
        'SELF_LOOP',
      );
    }
  }

  // 3. Detect Orphan Nodes (only if total nodes > 1)
  if (nodes.length > 1) {
    const connectedNodes = new Set<string>();
    for (const edge of edges) {
      connectedNodes.add(edge.from);
      connectedNodes.add(edge.to);
    }
    for (const node of nodes) {
      if (!connectedNodes.has(node.id)) {
        throw new DagValidationError(
          `Orphan node detected: ${node.id}`,
          'ORPHAN_NODE',
        );
      }
    }
  }

  // 4. Cycle Detection using DFS 3-color algorithm
  // Colors: 0 = white (unvisited), 1 = gray (visiting), 2 = black (visited)
  const colors: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};

  for (const nodeId of nodeIds) {
    colors[nodeId] = 0;
    adjList[nodeId] = [];
  }

  for (const edge of edges) {
    adjList[edge.from].push(edge.to);
  }

  function dfs(nodeId: string): boolean {
    colors[nodeId] = 1; // gray (visiting)

    const neighbors = adjList[nodeId] || [];
    for (const neighbor of neighbors) {
      if (colors[neighbor] === 1) {
        // Found gray node -> cycle detected!
        return true;
      }
      if (colors[neighbor] === 0) {
        if (dfs(neighbor)) {
          return true;
        }
      }
    }

    colors[nodeId] = 2; // black (visited)
    return false;
  }

  for (const nodeId of nodeIds) {
    if (colors[nodeId] === 0) {
      if (dfs(nodeId)) {
        throw new DagValidationError(
          'Cycle detected in workflow graph',
          'CYCLE_DETECTED',
        );
      }
    }
  }

  return { nodes, edges };
}
