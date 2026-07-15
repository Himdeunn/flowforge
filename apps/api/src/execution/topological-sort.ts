import { DagDefinition } from './dag-parser';

export function getExecutionLayers(dag: DagDefinition): string[][] {
  const { nodes, edges } = dag;

  const nodeIds = nodes.map((n) => n.id);
  const inDegree: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};

  // Initialize in-degree and adjacency list
  for (const nodeId of nodeIds) {
    inDegree[nodeId] = 0;
    adjList[nodeId] = [];
  }

  // Populate in-degree and adjacency list
  for (const edge of edges) {
    adjList[edge.from].push(edge.to);
    inDegree[edge.to]++;
  }

  const layers: string[][] = [];
  let processedCount = 0;

  // Repeat until all nodes are processed
  while (processedCount < nodeIds.length) {
    // Find all nodes with current in-degree of 0
    const currentLayer: string[] = [];
    for (const nodeId of nodeIds) {
      if (inDegree[nodeId] === 0) {
        currentLayer.push(nodeId);
      }
    }

    if (currentLayer.length === 0) {
      // This shouldn't happen if cycle detection passed, but safe guard
      throw new Error('Cycle detected during topological sorting');
    }

    // Add to layers
    layers.push(currentLayer.sort()); // Sort for deterministic output
    processedCount += currentLayer.length;

    // Simulate removing these nodes from the graph
    for (const nodeId of currentLayer) {
      // Mark as processed (e.g. set in-degree to -1 so it's not picked up again)
      inDegree[nodeId] = -1;

      // Decrement in-degree of neighbors
      const neighbors = adjList[nodeId] || [];
      for (const neighbor of neighbors) {
        if (inDegree[neighbor] > 0) {
          inDegree[neighbor]--;
        }
      }
    }
  }

  return layers;
}
