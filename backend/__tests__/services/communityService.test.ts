describe('communityService', () => {
  beforeEach(() => {
    jest.resetModules();

    // Make recompute-by-count easy to hit (N=2) and prevent time-based recompute
    process.env.COMMUNITY_RECOMPUTE_EVERY_N_TX = '2';
    process.env.COMMUNITY_RECOMPUTE_INTERVAL_MS = '99999999';

    // Mock the graph repo used by computeCommunities()
    jest.doMock('../../repositories/graphRepository', () => ({
      getAllNodes: jest
        .fn()
        .mockResolvedValue([
          { id: 'A' },
          { id: 'B' },
          { id: 'C' },
          { id: 'D' },
        ]),
      getAllEdges: jest.fn().mockResolvedValue([
        { source: 'A', target: 'B', transactionCount: 2, transactionAmount: 1 },
        { source: 'C', target: 'D', transactionCount: 1, transactionAmount: 1 },
      ]),
    }));

    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore?.();
  });

  it('computeCommunities groups weakly-connected components; augment overlays communityId', async () => {
    const svc = await import('../../services/communityService');

    await svc.computeCommunities();
    const nodes = await svc.augmentNodesWithCommunities([
      { id: 'A' },
      { id: 'B' },
      { id: 'C' },
      { id: 'D' },
    ]);

    // Expect exactly 2 communities; A&B share, C&D share
    const byComm = nodes.reduce<Record<string, string[]>>((acc, n) => {
      const key = n.communityId ?? 'none';
      (acc[key] ||= []).push(n.id);
      return acc;
    }, {});

    const groups = Object.values(byComm).map((arr) => arr.sort());
    expect(groups).toContainEqual(['A', 'B']);
    expect(groups).toContainEqual(['C', 'D']);
    expect(Object.keys(byComm)).toHaveLength(2);
  });

  it('maybeRecomputeCommunities recomputes on empty cache, then again after N=2 events', async () => {
    const graphRepo = await import('../../repositories/graphRepository');
    const svc = await import('../../services/communityService');

    // 1) Cache empty → recompute immediately
    await svc.maybeRecomputeCommunities();
    expect(graphRepo.getAllNodes as jest.Mock).toHaveBeenCalledTimes(1);
    expect(graphRepo.getAllEdges as jest.Mock).toHaveBeenCalledTimes(1);

    // 2) +1 tx but below threshold → no recompute
    await svc.maybeRecomputeCommunities();
    expect(graphRepo.getAllNodes as jest.Mock).toHaveBeenCalledTimes(1);
    expect(graphRepo.getAllEdges as jest.Mock).toHaveBeenCalledTimes(1);

    // 3) Reach threshold N=2 → recompute again
    await svc.maybeRecomputeCommunities();
    expect(graphRepo.getAllNodes as jest.Mock).toHaveBeenCalledTimes(2);
    expect(graphRepo.getAllEdges as jest.Mock).toHaveBeenCalledTimes(2);
  });
});
