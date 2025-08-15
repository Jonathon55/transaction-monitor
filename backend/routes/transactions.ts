import express, { Request, Response } from 'express';
import * as transactionService from '../services/transactionService';
import * as graphService from '../services/graphService';
import * as graphRepo from '../repositories/graphRepository';
import { emitGraphUpdate } from '../services/notificationService';
import { Server } from 'socket.io';

const router = express.Router();

/**
 * GET /api/transactions
 * Retrieve all transactions
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
    try {
        const transactions = await transactionService.getAllTransactions();
        res.json({ success: true, data: transactions });
    } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

/**
 * GET /api/transactions/nodes
 * Get all business nodes with enriched industry data
 */
router.get('/nodes', async (_req: Request, res: Response): Promise<void> => {
    try {
        const { nodes } = await graphService.getEnrichedGraphData();
        res.json({ success: true, data: nodes });
    } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

/**
 * GET /api/transactions/edges
 * Get all transaction edges between businesses
 */
router.get('/edges', async (_req: Request, res: Response): Promise<void> => {
    try {
        const edges = await graphRepo.getAllEdges();
        res.json({ success: true, data: edges });
    } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

/**
 * GET /api/transactions/filter
 * Filter transactions by business, date range, or amount
 */
router.get('/filter', async (req: Request, res: Response): Promise<void> => {
    const { from, to, startDate, endDate, minAmount, maxAmount } = req.query;
    try {
        const filteredTransactions = await transactionService.getFilteredTransactions(
            from as string | undefined,
            to as string | undefined,
            startDate as string | undefined,
            endDate as string | undefined,
            minAmount as string | undefined,
            maxAmount as string | undefined
        );
        res.json({ success: true, data: filteredTransactions });
    } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

/**
 * POST /api/transactions
 * Create a new transaction between two businesses
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
    const { from, to, amount, timestamp } = req.body;
    try {
        // Create the transaction
        const transaction = await transactionService.createTransaction({ from, to, amount, timestamp });
        
        // Emit an event to all connected clients
        const io = req.app.get('io') as Server | undefined;
        await emitGraphUpdate(io, transaction);
        
        res.json({ success: true, data: transaction });
    } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

export default router;