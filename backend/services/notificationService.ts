import { Server, Socket } from 'socket.io';
import * as graphService from './graphService';
import * as metricsService from './metricsService';
import { Transaction, Alert } from '../types';
import { augmentNodesWithRisk } from './riskService';
import {
  augmentNodesWithCommunities,
  maybeRecomputeCommunities,
  initializeCommunitiesOnStartup,
} from './communityService';

/**
 * Compose the graph data we send to clients: enriched nodes + edges.
 */
async function getAugmentedGraphData() {
  const { nodes, edges } = await graphService.getEnrichedGraphData();
  const nodesWithRisk = augmentNodesWithRisk(nodes);
  const nodesWithRiskAndCommunities = await augmentNodesWithCommunities(
    nodesWithRisk
  );
  return { nodes: nodesWithRiskAndCommunities, edges };
}

/**
 * Emit initialData to a newly connected socket.
 * Call this from the connection handler in index.ts.
 */
export async function emitInitialGraph(socket: Socket): Promise<void> {
  await initializeCommunitiesOnStartup();
  const { nodes, edges } = await getAugmentedGraphData();
  socket.emit('initialData', {
    nodes,
    edges,
    metrics: metricsService.getRollup(), // NEW
  });
}

/**
 * Emits a graph update event to all connected Socket.IO clients
 * @param {Server | undefined} io - Socket.IO instance
 * @param {Transaction} transactionDetails - Details of the new transaction
 * @param {Alert} alerts - Alerts produced by rules for this transaction (optional)
 */
export const emitGraphUpdate = async (
  io: Server | undefined,
  transactionDetails: Transaction,
  alerts?: Alert[]
): Promise<void> => {
  if (!io) return;

  metricsService.record(transactionDetails, alerts);

  // Maybe recompute communities based on thresholds
  await maybeRecomputeCommunities();

  const { nodes, edges } = await getAugmentedGraphData();

  const metrics = metricsService.getRollup();

  io.emit('graphUpdate', {
    nodes,
    edges,
    newTransaction: transactionDetails,
    alerts,
    metrics,
  });
};
