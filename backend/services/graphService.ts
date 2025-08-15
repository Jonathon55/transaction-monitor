import * as businessRepo from '../repositories/businessRepository';
import * as graphRepo from '../repositories/graphRepository';
import { GraphNode, GraphEdge } from '../types';

/**
 * Gets complete graph data
 * @returns Object containing nodes and edges for graph visualization
 */
export const getGraphData = async (): Promise<{ nodes: GraphNode[], edges: GraphEdge[] }> => {
    const [nodes, edges] = await Promise.all( [ graphRepo.getAllNodes(), graphRepo.getAllEdges() ] );
    return { nodes, edges };
};

/**
 * Gets complete graph data with enriched nodes
 * @returns Object containing enriched nodes and edges for graph visualization
 */
export const getEnrichedGraphData = async (): Promise<{ nodes: GraphNode[], edges: GraphEdge[] }> => {
    const [nodes, edges] = await Promise.all([
        graphRepo.getAllNodes(),
        graphRepo.getAllEdges()
    ]);
    
    let enrichedNodes = nodes;
    if (nodes && nodes.length > 0) {
        const businessIds = nodes.map(node => node.id);
        const { nameMap } = await businessRepo.getBusinessDetails(businessIds);
        
        enrichedNodes = nodes.map(node => ({
            ...node,
            label: nameMap[node.id]
        }));
    }
    
    return {
        nodes: enrichedNodes,
        edges
    };
};

