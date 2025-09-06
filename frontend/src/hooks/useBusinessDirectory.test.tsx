import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the socket module used by the hook
jest.mock('../../services/socket', () => {
  const listeners: Record<string, Set<Function>> = {};
  const socket = {
    on: (event: string, cb: Function) => {
      (listeners[event] ||= new Set()).add(cb);
    },
    off: (event: string, cb: Function) => {
      listeners[event]?.delete(cb);
    },
    __emit: (event: string, payload?: any) => {
      listeners[event]?.forEach((cb) => cb(payload));
    },
  };
  return { getSocket: () => socket };
});

import { getSocket } from '../services/socket';
import { useBusinessDirectory } from './useBusinessDirectory';

describe('useBusinessDirectory', () => {
  const businesses = [
    { business_id: 'A', name: 'Alpha', industry: 'Tech' },
    { business_id: 'B', name: 'Beta', industry: 'Finance' },
  ];

  beforeEach(() => {
    (global.fetch as any) = jest.fn(async (url: RequestInfo) => {
      const s = String(url);
      if (s.includes('/api/businesses')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: businesses }),
        } as any;
      }
      throw new Error('Unexpected fetch: ' + s);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads directory via HTTP and provides lookup()', async () => {
    const { result } = renderHook(() => useBusinessDirectory());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.lookup('A')).toBe('Alpha');
    expect(result.current.lookup('B')).toBe('Beta');
    // Missing maps to its own ID
    expect(result.current.lookup('Z')).toBe('Z');
  });

  it('upserts names from WebSocket node payloads', async () => {
    const { result } = renderHook(() => useBusinessDirectory());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const socket: any = getSocket();
    await act(async () => {
      socket.__emit('graphUpdate', {
        nodes: [{ id: 'C', label: 'Gamma', industry: 'Energy' }],
      });
    });

    expect(result.current.lookup('C')).toBe('Gamma');
  });

  it('ignores malformed node entries', async () => {
    const { result } = renderHook(() => useBusinessDirectory());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const socket: any = getSocket();
    await act(async () => {
      socket.__emit('graphUpdate', {
        nodes: [{ id: 'X' }, { label: 'NoId' }, null],
      });
    });

    // Still unmapped
    expect(result.current.lookup('X')).toBe('X');
    expect(result.current.lookup('NoId')).toBe('NoId');
  });
});
