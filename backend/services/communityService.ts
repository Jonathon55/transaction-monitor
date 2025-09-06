import * as graphRepository from '../repositories/graphRepository';
import { GraphEdge, GraphNode } from '../types';

// -------------------- configuration (env + defaults) --------------------
const COMMUNITY_RECOMPUTE_EVERY_N_TRANSACTIONS: number = Number(
  process.env.COMMUNITY_RECOMPUTE_EVERY_N_TX ?? 5
);
const COMMUNITY_RECOMPUTE_INTERVAL_MILLIS: number = Number(
  process.env.COMMUNITY_RECOMPUTE_INTERVAL_MS ?? 30_000
);

/**
 * communitiesByNodeId maps a nodeId -> communityId (e.g., "c1", "c2", ...).
 * We recompute periodically (time- and count-based).
 */
let communitiesByNodeId: Map<string, string> = new Map();
let lastRecomputeEpochMillis: number = 0;
let transactionsSinceLastRecompute: number = 0;

// -------------------- union-find implementation --------------------
class UnionFind {
  private parentByElement: Map<string, string>;
  private rankByElement: Map<string, number>;

  constructor(elements: string[]) {
    this.parentByElement = new Map();
    this.rankByElement = new Map();
    for (const element of elements) {
      this.parentByElement.set(element, element);
      this.rankByElement.set(element, 0);
    }
  }

  public find(element: string): string {
    const parent = this.parentByElement.get(element);
    if (!parent) {
      // Should not happen if constructed with all nodes
      this.parentByElement.set(element, element);
      this.rankByElement.set(element, 0);
      return element;
    }
    if (parent === element) return element;

    // Path compression
    const root = this.find(parent);
    this.parentByElement.set(element, root);
    return root;
  }

  public union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return;

    const rankA = this.rankByElement.get(rootA) ?? 0;
    const rankB = this.rankByElement.get(rootB) ?? 0;

    if (rankA < rankB) {
      this.parentByElement.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parentByElement.set(rootB, rootA);
    } else {
      this.parentByElement.set(rootB, rootA);
      this.rankByElement.set(rootA, rankA + 1);
    }
  }
}

// -------------------- compute & cache communities --------------------
/**
 * Computes weakly connected components from the current graph (treating edges as undirected),
 * and updates the in-memory communitiesByNodeId map.
 */
export async function computeCommunities(): Promise<void> {
  const nodeList: GraphNode[] = await graphRepository.getAllNodes();
  const edgeList: GraphEdge[] = await graphRepository.getAllEdges();

  const nodeIds: string[] = nodeList.map((node) => node.id);
  const unionFind = new UnionFind(nodeIds);

  // Treat edges as undirected for weak components: union(source, target)
  for (const edge of edgeList) {
    unionFind.union(edge.source, edge.target);
  }

  // Map each root to a stable community label (c1, c2, ...)
  const rootToCommunityId: Map<string, string> = new Map();
  let communityIndex = 1;
  const newCommunitiesByNodeId: Map<string, string> = new Map();

  for (const nodeId of nodeIds) {
    const root = unionFind.find(nodeId);
    if (!rootToCommunityId.has(root)) {
      rootToCommunityId.set(root, `c${communityIndex++}`);
    }
    newCommunitiesByNodeId.set(nodeId, rootToCommunityId.get(root)!);
  }

  communitiesByNodeId = newCommunitiesByNodeId;
  lastRecomputeEpochMillis = Date.now();
  transactionsSinceLastRecompute = 0;

  console.log(
    `[community] recomputed ${rootToCommunityId.size} communities for ${nodeIds.length} nodes`
  );
}

/**
 * Increments the transaction counter and recomputes communities if either:
 * - enough new transactions have arrived, or
 * - enough time has elapsed since the last recompute.
 */
export async function maybeRecomputeCommunities(): Promise<void> {
  transactionsSinceLastRecompute += 1;
  const nowEpochMillis = Date.now();

  const enoughTransactions =
    transactionsSinceLastRecompute >= COMMUNITY_RECOMPUTE_EVERY_N_TRANSACTIONS;
  const intervalElapsed =
    nowEpochMillis - lastRecomputeEpochMillis >=
    COMMUNITY_RECOMPUTE_INTERVAL_MILLIS;

  if (communitiesByNodeId.size === 0 || enoughTransactions || intervalElapsed) {
    await computeCommunities();
  }
}

/**
 * Overlays communityId onto nodes for socket payloads.
 * If the cache is empty (first call), we compute communities.
 */
export async function augmentNodesWithCommunities(
  nodes: GraphNode[]
): Promise<GraphNode[]> {
  if (communitiesByNodeId.size === 0) {
    await computeCommunities();
  }
  return nodes.map((node) => ({
    ...node,
    communityId: communitiesByNodeId.get(node.id) ?? undefined,
  }));
}

/**
 * Explicit initializer (call on server startup).
 */
export async function initializeCommunitiesOnStartup(): Promise<void> {
  await computeCommunities();
}
