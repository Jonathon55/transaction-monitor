import fs from 'fs';
import os from 'os';
import path from 'path';

describe('alertRepository', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sayari-alerts-'));
  const dbFile = path.join(tmpDir, 'alerts-test.db');

  beforeEach(() => {
    // Pre-create the SQLite file so OPEN_READWRITE succeeds
    try {
      fs.closeSync(fs.openSync(dbFile, 'w'));
    } catch (_) {
      // ignore
    }
    process.env.DATABASE_PATH = dbFile;
    jest.resetModules();
  });

  afterAll(() => {
    try {
      fs.unlinkSync(dbFile);
    } catch {}
    try {
      fs.rmdirSync(tmpDir);
    } catch {}
  });

  it('creates table, inserts, and reads alerts (descending by id)', async () => {
    const repo = await import('../../repositories/alertRepository');

    const now = new Date().toISOString();
    const id1 = await repo.insertAlert({
      type: 'HIGH_VALUE',
      severity: 'high',
      from: 'A',
      to: 'B',
      amount: 100_000,
      timestamp: now,
    });
    expect(id1).toBeGreaterThan(0);

    const id2 = await repo.insertAlert({
      type: 'BURST',
      severity: 'medium',
      from: 'A',
      to: 'B',
      amount: 42_000,
      timestamp: now,
    });
    expect(id2).toBeGreaterThan(id1);

    const all = await repo.findRecentAlerts(10);
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({
      id: id2,
      type: 'BURST',
      severity: 'medium',
      from: 'A',
      to: 'B',
      amount: 42000,
      timestamp: now,
    });
    expect(all[1]).toMatchObject({
      id: id1,
      type: 'HIGH_VALUE',
      severity: 'high',
      from: 'A',
      to: 'B',
      amount: 100000,
      timestamp: now,
    });
  }, 15000);
});
