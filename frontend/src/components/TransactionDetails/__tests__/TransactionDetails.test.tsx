import { render, screen, waitFor, act } from '@testing-library/react';

// Mock the socket module used by the component
jest.mock('../../../services/socket', () => {
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

import { getSocket } from '../../../services/socket';
import TransactionDetailsTable from '../TransactionDetails';

jest.useFakeTimers();

describe('TransactionDetailsTable', () => {
  const businesses = [
    { business_id: 'A', name: 'Alpha', industry: 'Tech' },
    { business_id: 'B', name: 'Beta', industry: 'Finance' },
  ];

  const initialTx = [
    {
      from: 'A',
      to: 'B',
      amount: 100000,
      timestamp: '2025-09-05T16:05:13.848Z',
    },
  ];

  beforeEach(() => {
    (global.fetch as any) = jest.fn(async (url: RequestInfo) => {
      const s = String(url);

      if (s.includes('/api/businesses/transactions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: initialTx }),
        } as any;
      }

      if (s.includes('/api/businesses/')) {
        // transaction-count per business
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { transactionCount: 0 } }),
        } as any;
      }

      if (s.includes('/api/businesses')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: businesses }),
        } as any;
      }

      // Not used here; safe default
      if (s.includes('/api/transactions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        } as any;
      }

      throw new Error('Unexpected fetch: ' + s);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders names (not raw IDs) for From/To', async () => {
    render(<TransactionDetailsTable />);

    // Wait until the detailed transactions table is present
    await waitFor(() =>
      expect(
        screen.getByRole('table', { name: /Detailed Transactions Table/i })
      ).toBeInTheDocument()
    );

    // Confirm visible names
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('adds a new transaction via graphUpdate and highlights it', async () => {
    render(<TransactionDetailsTable />);

    await waitFor(() =>
      expect(
        screen.getByRole('table', { name: /Detailed Transactions Table/i })
      ).toBeInTheDocument()
    );

    const socket: any = getSocket();
    const newTx = {
      from: 'B',
      to: 'A',
      amount: 42000,
      timestamp: '2025-09-05T16:06:21.982Z',
    };

    // Emit a live update – wrap in act() to avoid warnings
    await act(async () => {
      socket.__emit('graphUpdate', { newTransaction: newTx });
    });

    // Component renders localized time, so assert on the amount which is stable
    const amountCell = await screen.findByText(/\$42,000\.00/);
    const newRow = amountCell.closest('tr')!;
    expect(newRow).toHaveClass('new-transaction-row');

    // After ~3s highlight should fade (class removed) – also wrap in act()
    await act(async () => {
      jest.advanceTimersByTime(3100);
    });

    await waitFor(() => {
      expect(newRow).not.toHaveClass('new-transaction-row');
    });
  });
});
