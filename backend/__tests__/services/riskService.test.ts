describe('riskService', () => {
  beforeEach(() => {
    jest.resetModules();

    // Make rules easy to trigger & predictable
    process.env.HIGH_VALUE_THRESHOLD = '50000';
    process.env.BURST_MIN_COUNT = '3';
    process.env.ALERTS_PENALTY_DIVISOR = '8';
    process.env.RISK_WEIGHT_VOLUME = '0.2';
    process.env.RISK_WEIGHT_DEGREE = '0.2';
    process.env.RISK_WEIGHT_ALERTS = '0.6';

    jest.doMock('../../repositories/graphRepository', () => ({
      // Called twice:
      //  - BURST (with startDate) -> return 3 records
      //  - FIRST_TIME_LINK (no startDate) -> return 1 record
      findFilteredEdges: jest.fn().mockImplementation((...args: any[]) => {
        const startDate = args[2];
        if (startDate) return Promise.resolve([{}, {}, {}]); // BURST
        return Promise.resolve([{}]); // FIRST_TIME_LINK
      }),
    }));

    jest.doMock('../../repositories/alertRepository', () => ({
      insertAlert: jest.fn().mockResolvedValue(123),
    }));
  });

  it('evaluateAndUpdate emits HV + BURST + FTL; risk scores & alertCounts update', async () => {
    const riskService = await import('../../services/riskService');
    const tx = {
      from: 'A',
      to: 'B',
      amount: 100_000,
      timestamp: new Date().toISOString(),
    };

    const { alerts, impactedNodeIds } = await riskService.evaluateAndUpdate(tx);

    const types = alerts.map((a) => a.type).sort();
    expect(types).toEqual(['BURST', 'FIRST_TIME_LINK', 'HIGH_VALUE'].sort());
    expect(impactedNodeIds.sort()).toEqual(['A', 'B'].sort());

    const projected = riskService.augmentNodesWithRisk([
      { id: 'A' },
      { id: 'B' },
    ]);
    for (const n of projected) {
      // Each node got two non-low alerts in the window (HV + BURST)
      expect(n.alertsCount).toBe(2);
      expect(n.riskBreakdown?.weights).toEqual({
        volume: 0.2,
        degree: 0.2,
        alerts: 0.6,
      });
      expect(typeof n.riskScore).toBe('number');
      expect(n.riskScore).toBeGreaterThan(0);
      expect(n.riskScore).toBeLessThanOrEqual(100);
    }

    const alertRepo = await import('../../repositories/alertRepository');
    expect((alertRepo.insertAlert as jest.Mock).mock.calls).toHaveLength(3);
  });

  it('augmentNodesWithRisk returns zeroed fields for unseen nodes', async () => {
    const riskService = await import('../../services/riskService');
    const nodes = riskService.augmentNodesWithRisk([{ id: 'Z' }]);
    expect(nodes[0]).toMatchObject({
      id: 'Z',
      riskScore: 0,
      alertsCount: 0,
    });
  });
});
