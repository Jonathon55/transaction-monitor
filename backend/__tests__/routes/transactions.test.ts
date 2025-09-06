import express from 'express';
import request from 'supertest';

describe('routes/transactions POST /api/transactions', () => {
  beforeEach(() => {
    jest.resetModules();

    // Mock deps the route uses
    jest.doMock('../../repositories/graphRepository', () => ({
      createOrFindNode: jest.fn().mockResolvedValue(undefined),
    }));

    jest.doMock('../../services/transactionService', () => ({
      createTransaction: jest
        .fn()
        .mockImplementation((t) => Promise.resolve(t)),
      getAllTransactions: jest.fn(),
      getFilteredTransactions: jest.fn(),
    }));

    jest.doMock('../../services/riskService', () => ({
      evaluateAndUpdate: jest
        .fn()
        .mockResolvedValue({ alerts: [], impactedNodeIds: [] }),
    }));

    jest.doMock('../../services/notificationService', () => ({
      emitGraphUpdate: jest.fn().mockResolvedValue(undefined),
    }));
  });

  function buildApp() {
    const app = express();
    app.use(express.json());
    // Inject a fake io for the router to read via req.app.get('io')
    app.set('io', { emit: jest.fn() });
    return app;
  }

  it('400 on invalid payload', async () => {
    const router = (await import('../../routes/transactions')).default;
    const app = buildApp();
    app.use('/api/transactions', router);

    const res = await request(app)
      .post('/api/transactions')
      .send({
        from: 'A',
        to: 'B',
        amount: 'not-a-number',
        timestamp: '2025-01-01',
      } as any);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('200 on valid payload; calls evaluateAndUpdate & emitGraphUpdate', async () => {
    const router = (await import('../../routes/transactions')).default;
    const app = buildApp();
    app.use('/api/transactions', router);

    const body = {
      from: 'A',
      to: 'B',
      amount: 100,
      timestamp: '2025-01-01T00:00:00.000Z',
    };
    const res = await request(app).post('/api/transactions').send(body);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(body);

    const risk = await import('../../services/riskService');
    const notify = await import('../../services/notificationService');

    expect(risk.evaluateAndUpdate).toHaveBeenCalled();
    expect(notify.emitGraphUpdate).toHaveBeenCalled();
  });
});
