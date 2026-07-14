import { DagDefinition } from './dag-parser';
import { getExecutionLayers } from './topological-sort';

describe('Topological Sort (Execution Layers)', () => {
  it('should sort a linear DAG into sequential layers', () => {
    const linearDag: DagDefinition = {
      nodes: [
        { id: 'A', type: 'http', config: {} },
        { id: 'B', type: 'delay', config: {} },
        { id: 'C', type: 'script', config: {} },
      ],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
      ],
    };

    const layers = getExecutionLayers(linearDag);
    expect(layers).toEqual([['A'], ['B'], ['C']]);
  });

  it('should sort a branching DAG with parallel components', () => {
    const branchingDag: DagDefinition = {
      nodes: [
        { id: 'fetchData', type: 'http', config: {} },
        { id: 'wait', type: 'delay', config: {} },
        { id: 'checkStatus', type: 'condition', config: {} },
        { id: 'processData', type: 'script', config: {} },
      ],
      edges: [
        { from: 'fetchData', to: 'wait' },
        { from: 'fetchData', to: 'checkStatus' },
        { from: 'wait', to: 'processData' },
        { from: 'checkStatus', to: 'processData' },
      ],
    };

    // Expected Urutan Layer:
    // Layer 0: [fetchData]
    // Layer 1: [checkStatus, wait] (both can run in parallel after fetchData)
    // Layer 2: [processData] (runs after both complete)
    const layers = getExecutionLayers(branchingDag);
    expect(layers).toEqual([
      ['fetchData'],
      ['checkStatus', 'wait'],
      ['processData'],
    ]);
  });

  it('should handle complex multiple root and leaf components', () => {
    const complexDag: DagDefinition = {
      nodes: [
        { id: 'Root1', type: 'http', config: {} },
        { id: 'Root2', type: 'http', config: {} },
        { id: 'Middle1', type: 'delay', config: {} },
        { id: 'Middle2', type: 'delay', config: {} },
        { id: 'Leaf1', type: 'script', config: {} },
      ],
      edges: [
        { from: 'Root1', to: 'Middle1' },
        { from: 'Root2', to: 'Middle1' },
        { from: 'Root2', to: 'Middle2' },
        { from: 'Middle1', to: 'Leaf1' },
        { from: 'Middle2', to: 'Leaf1' },
      ],
    };

    // Layer 0: Root1 and Root2 have in-degree 0.
    // Layer 1: Middle1 depends on Root1, Root2. Middle2 depends on Root2. Both resolved.
    // Layer 2: Leaf1 depends on Middle1, Middle2.
    const layers = getExecutionLayers(complexDag);
    expect(layers).toEqual([
      ['Root1', 'Root2'],
      ['Middle1', 'Middle2'],
      ['Leaf1'],
    ]);
  });
});
