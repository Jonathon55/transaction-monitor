import { Server } from 'socket.io';
import * as graphService from './graphService';
import { Transaction } from '../types';

/**
 * Emits a graph update event to all connected Socket.IO clients
 * @param {Server | undefined} io - Socket.IO instance
 * @param {Transaction} transactionDetails - Details of the new transaction
 */
export const emitGraphUpdate = async (io: Server | undefined, transactionDetails: Transaction): Promise<void> => {
    if (!io) return;
    
    const { nodes, edges } = await graphService.getEnrichedGraphData();
    io.emit('graphUpdate', { 
        nodes, 
        edges,
        newTransaction: transactionDetails
    });
};