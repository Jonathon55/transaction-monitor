import * as graphRepository from '../repositories/graphRepository';
import * as alertRepository from '../repositories/alertRepository';
import {
  Alert,
  AlertSeverity,
  AlertType,
  GraphNode,
  Transaction,
  BusinessId,
  NodeStats,
} from '../types';

const HIGH_VALUE_THRESHOLD: number = Number(
  process.env.HIGH_VALUE_THRESHOLD ?? 95_000
);
const BURST_WINDOW_MILLIS: number = Number(
  process.env.BURST_WINDOW_MS ?? 60_000
);
const BURST_MIN_COUNT: number = Number(process.env.BURST_MIN_COUNT ?? 4);
const ALERTS_WINDOW_MILLIS: number = Number(
  process.env.ALERTS_WINDOW_MS ?? 5 * 60_000
);
const ALERTS_PENALTY_DIVISOR: number = Number(
  process.env.ALERTS_PENALTY_DIVISOR ?? 8
);

// Explicit risk weights: risk = 100 * ( wV * volume + wD * degree + wA * alerts )
const WEIGHT_VOLUME: number = Number(process.env.RISK_WEIGHT_VOLUME ?? 0.2);
const WEIGHT_DEGREE: number = Number(process.env.RISK_WEIGHT_DEGREE ?? 0.2);
const WEIGHT_ALERTS: number = Number(process.env.RISK_WEIGHT_ALERTS ?? 0.6);

// -------------------- in-memory state --------------------
const nodeStatsById: Map<BusinessId, NodeStats> = new Map();

function getOrCreateNodeStats(businessId: BusinessId): NodeStats {
  const existing = nodeStatsById.get(businessId);
  if (existing) return existing;

  const created: NodeStats = {
    outVolume: 0,
    inVolume: 0,
    degreeOut: new Set<BusinessId>(),
    degreeIn: new Set<BusinessId>(),
    alertTimestamps: [],
    riskScore: 0,
  };
  nodeStatsById.set(businessId, created);
  return created;
}

function pruneAlertWindowInPlace(
  stats: NodeStats,
  nowEpochMillis: number
): void {
  if (stats.alertTimestamps.length === 0) return;
  const cutoff = nowEpochMillis - ALERTS_WINDOW_MILLIS;
  let firstIndexInside = 0;
  while (
    firstIndexInside < stats.alertTimestamps.length &&
    stats.alertTimestamps[firstIndexInside] < cutoff
  ) {
    firstIndexInside++;
  }
  if (firstIndexInside > 0) {
    stats.alertTimestamps.splice(0, firstIndexInside);
  }
}

// -------------------- z-score & normalization helpers --------------------
const clampZeroToOne = (value: number): number =>
  Math.max(0, Math.min(1, value));

function computeGlobalMaxDegree(): number {
  let globalMaxDegree = 1;
  nodeStatsById.forEach((stats) => {
    const degree = stats.degreeIn.size + stats.degreeOut.size;
    if (degree > globalMaxDegree) globalMaxDegree = degree;
  });
  return globalMaxDegree;
}

function createAlert(
  alertType: AlertType,
  severity: AlertSeverity,
  transaction: Transaction
): Alert {
  return {
    type: alertType,
    severity,
    from: transaction.from,
    to: transaction.to,
    amount: transaction.amount,
    timestamp: transaction.timestamp,
  };
}

async function evaluateAllRulesForTransaction(
  transaction: Transaction
): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // SELF_LOOP
  if (transaction.from === transaction.to) {
    alerts.push(createAlert('SELF_LOOP', 'high', transaction));
  }

  // HIGH_VALUE
  if (transaction.amount >= HIGH_VALUE_THRESHOLD) {
    alerts.push(createAlert('HIGH_VALUE', 'high', transaction));
  }

  // BURST: recent count for pair within time window
  try {
    const windowStartIso = new Date(
      new Date(transaction.timestamp).getTime() - BURST_WINDOW_MILLIS
    ).toISOString();
    const recentForPair = await graphRepository.findFilteredEdges(
      transaction.from,
      transaction.to,
      windowStartIso,
      undefined,
      undefined,
      undefined
    );
    if (recentForPair.length >= BURST_MIN_COUNT) {
      alerts.push(createAlert('BURST', 'medium', transaction));
    }
  } catch (error) {
    console.error(
      '[risk] BURST rule failed; continuing:',
      (error as Error).message
    );
  }

  // FIRST_TIME_LINK: only the current edge exists
  try {
    const allForPair = await graphRepository.findFilteredEdges(
      transaction.from,
      transaction.to
    );
    if (allForPair.length === 1) {
      alerts.push(createAlert('FIRST_TIME_LINK', 'low', transaction));
    }
  } catch (error) {
    console.error(
      '[risk] FIRST_TIME_LINK rule failed; continuing:',
      (error as Error).message
    );
  }

  return alerts;
}
function computeGlobalMaxTotalVolume(): number {
  let maxTotal = 1;
  nodeStatsById.forEach((stats) => {
    const total = stats.outVolume + stats.inVolume;
    if (total > maxTotal) maxTotal = total;
  });
  return maxTotal;
}
/**
 * Update in-memory stats, evaluate/persist alerts, recompute risk, and return alerts + impacted nodes.
 */
export async function evaluateAndUpdate(
  transaction: Transaction
): Promise<{ alerts: Alert[]; impactedNodeIds: BusinessId[] }> {
  // 1) Update rolling stats
  const fromStats = getOrCreateNodeStats(transaction.from);
  const toStats = getOrCreateNodeStats(transaction.to);

  fromStats.outVolume += transaction.amount;
  toStats.inVolume += transaction.amount;

  fromStats.degreeOut.add(transaction.to);
  toStats.degreeIn.add(transaction.from);

  // 2) Evaluate rules
  const alerts = await evaluateAllRulesForTransaction(transaction);

  // 3) Persist alerts and update alert windows
  const nowEpochMillis = Date.now();
  for (const alert of alerts) {
    try {
      const insertedId = await alertRepository.insertAlert(alert);
      alert.id = insertedId;
    } catch (error) {
      console.error(
        '[risk] failed to persist alert:',
        alert,
        (error as Error).message
      );
    }

    if (alert.severity !== 'low') {
      const fromStatsForWindow = getOrCreateNodeStats(alert.from);
      const toStatsForWindow = getOrCreateNodeStats(alert.to);
      fromStatsForWindow.alertTimestamps.push(nowEpochMillis);
      toStatsForWindow.alertTimestamps.push(nowEpochMillis);
    }
  }
  nodeStatsById.forEach((stats) =>
    pruneAlertWindowInPlace(stats, nowEpochMillis)
  );

  // 4) Recompute risk scores across nodes (explainable, incremental)
  const globalMaxDegree = computeGlobalMaxDegree();

  nodeStatsById.forEach((stats) => {
    const totalVolume = stats.outVolume + stats.inVolume;

    const globalMaxTotalVolume = computeGlobalMaxTotalVolume();
    const volumeComponent = clampZeroToOne(
      Math.log1p(totalVolume) / Math.log1p(globalMaxTotalVolume)
    );
    const degree = stats.degreeIn.size + stats.degreeOut.size;
    const degreeComponent = clampZeroToOne(
      degree / Math.max(1, globalMaxDegree)
    );

    const recentAlertCount = stats.alertTimestamps.length;
    const alertsComponent = clampZeroToOne(
      recentAlertCount / Math.max(1, ALERTS_PENALTY_DIVISOR)
    );

    const rawScore =
      WEIGHT_VOLUME * volumeComponent +
      WEIGHT_DEGREE * degreeComponent +
      WEIGHT_ALERTS * alertsComponent;

    stats.riskScore = Math.round(100 * rawScore * 10) / 10; // 0..100, one decimal
    stats.lastComponents = {
      volumeComponent,
      degreeComponent,
      alertsComponent,
    };
  });

  return { alerts, impactedNodeIds: [transaction.from, transaction.to] };
}

/**
 * Project risk fields onto nodes for socket payloads (safe if stats missing).
 */
export function augmentNodesWithRisk(nodes: GraphNode[]): GraphNode[] {
  const nowEpochMillis = Date.now();
  return nodes.map((node) => {
    const stats = getOrCreateNodeStats(node.id);
    pruneAlertWindowInPlace(stats, nowEpochMillis);

    const volumeComponent = stats.lastComponents?.volumeComponent ?? 0;
    const degreeComponent = stats.lastComponents?.degreeComponent ?? 0;
    const alertsComponent = stats.lastComponents?.alertsComponent ?? 0;

    const weightedScore =
      WEIGHT_VOLUME * volumeComponent +
      WEIGHT_DEGREE * degreeComponent +
      WEIGHT_ALERTS * alertsComponent;

    return {
      ...node,
      riskScore: stats.riskScore ?? 0,
      alertsCount: stats.alertTimestamps.length ?? 0,
      riskBreakdown: {
        components: {
          volume: volumeComponent,
          degree: degreeComponent,
          alerts: alertsComponent,
        },
        weights: {
          volume: WEIGHT_VOLUME,
          degree: WEIGHT_DEGREE,
          alerts: WEIGHT_ALERTS,
        },
        weightedScore,
      },
    };
  });
}
