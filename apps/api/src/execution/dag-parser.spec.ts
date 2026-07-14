import { parseAndValidateDag, DagValidationError } from './dag-parser';

describe('DagParser & Validator', () => {
  it('should validate a correct DAG definition', () => {
    const validDag = {
      nodes: [
        { id: 'fetchData', type: 'http', config: { method: 'GET', url: 'https://api.example.com' } },
        { id: 'wait', type: 'delay', config: { durationMs: 2000 } },
        { id: 'checkStatus', type: 'condition', config: { expression: 'true' } },
        { id: 'processData', type: 'script', config: { script: 'transform.js' } },
      ],
      edges: [
        { from: 'fetchData', to: 'wait' },
        { from: 'wait', to: 'checkStatus' },
        { from: 'checkStatus', to: 'processData' },
      ],
    };

    const result = parseAndValidateDag(validDag);
    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);
  });

  it('should detect cycles in a workflow definition', () => {
    const cyclicDag = {
      nodes: [
        { id: 'A', type: 'http', config: {} },
        { id: 'B', type: 'delay', config: {} },
        { id: 'C', type: 'script', config: {} },
      ],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' }, // Back edge creating cycle
      ],
    };

    expect(() => parseAndValidateDag(cyclicDag)).toThrow(DagValidationError);
    try {
      parseAndValidateDag(cyclicDag);
    } catch (err: any) {
      expect(err.code).toBe('CYCLE_DETECTED');
    }
  });

  it('should detect orphan nodes in a workflow definition', () => {
    const orphanDag = {
      nodes: [
        { id: 'A', type: 'http', config: {} },
        { id: 'B', type: 'delay', config: {} },
        { id: 'OrphanNode', type: 'script', config: {} },
      ],
      edges: [
        { from: 'A', to: 'B' },
      ],
    };

    expect(() => parseAndValidateDag(orphanDag)).toThrow(DagValidationError);
    try {
      parseAndValidateDag(orphanDag);
    } catch (err: any) {
      expect(err.code).toBe('ORPHAN_NODE');
    }
  });

  it('should detect unknown step types', () => {
    const invalidTypeDag = {
      nodes: [
        { id: 'A', type: 'http', config: {} },
        { id: 'B', type: 'unknown-type-here', config: {} },
      ],
      edges: [
        { from: 'A', to: 'B' },
      ],
    };

    expect(() => parseAndValidateDag(invalidTypeDag)).toThrow(DagValidationError);
    try {
      parseAndValidateDag(invalidTypeDag);
    } catch (err: any) {
      expect(err.code).toBe('UNKNOWN_STEP_TYPE');
    }
  });

  it('should detect self-loops', () => {
    const selfLoopDag = {
      nodes: [
        { id: 'A', type: 'http', config: {} },
      ],
      edges: [
        { from: 'A', to: 'A' },
      ],
    };

    expect(() => parseAndValidateDag(selfLoopDag)).toThrow(DagValidationError);
    try {
      parseAndValidateDag(selfLoopDag);
    } catch (err: any) {
      expect(err.code).toBe('SELF_LOOP');
    }
  });
});
