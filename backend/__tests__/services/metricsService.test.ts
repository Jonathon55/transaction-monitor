describe('metricsService', () => {
  function fresh() {
    jest.resetModules();
    return import('../../services/metricsService');
  }

  it('records totals and severities', async () => {
    const metrics = await fresh();

    metrics.record({ from: 'A', to: 'B', amount: 10, timestamp: '' }, [
      {
        type: 'HIGH_VALUE',
        severity: 'high',
        from: 'A',
        to: 'B',
        amount: 10,
        timestamp: '',
      },
      {
        type: 'BURST',
        severity: 'medium',
        from: 'A',
        to: 'B',
        amount: 10,
        timestamp: '',
      },
      {
        type: 'FIRST_TIME_LINK',
        severity: 'low',
        from: 'A',
        to: 'B',
        amount: 10,
        timestamp: '',
      },
    ]);

    metrics.record({ from: 'B', to: 'C', amount: 5, timestamp: '' });

    const rollup = metrics.getRollup();
    expect(rollup.totalTransactions).toBe(2);
    expect(rollup.totalAmount).toBe(15);
    expect(rollup.alerts).toEqual({ total: 3, high: 1, medium: 1, low: 1 });
    expect(typeof rollup.generatedAt).toBe('string');
  });
});
