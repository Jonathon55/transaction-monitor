import neo4j, { Driver, Session } from 'neo4j-driver';
import { Transaction, GraphEdge, GraphNode } from '../types';

// Initialize driver once
const MEMGRAPH_URL = process.env.MEMGRAPH_URL || 'bolt://localhost:7687';
const driver: Driver = neo4j.driver(MEMGRAPH_URL, neo4j.auth.basic('', ''));

/**
 * Create or find a node in the graph
 */
export const createOrFindNode = async (businessId: string): Promise<any> => {
    const session: Session = driver.session();
    try {
        const result = await session.run(
            `
            MERGE (b:Business {business_id: $business_id})
            RETURN b
            `,
            { business_id: businessId }
        );
        return result.records[0].get('b');
    } finally {
        await session.close();
    }
};

/**
 * Create a new edge (transaction) in the graph
 */
export const createEdge = async (from: string, to: string, amount: number, timestamp: string): Promise<Transaction> => {
    const session: Session = driver.session();
    try {
        const result = await session.run(
            `
            MATCH (a:Business {business_id: $from}), (b:Business {business_id: $to})
            CREATE (a)-[t:TRANSACTION {amount: $amount, timestamp: $timestamp}]->(b)
            RETURN t
            `,
            { from, to, amount, timestamp }
        );
        
        if (result.records.length === 0) {
            console.error(`Transaction creation failed: Could not find businesses with IDs ${from} and/or ${to}`);
            return null as any;
        }
        
        // Return a properly formatted Transaction object
        return {
            from,
            to,
            amount,
            timestamp
        };
    } catch (error) {
        console.error('Error creating transaction:', (error as Error).message);
        throw error;
    } finally {
        await session.close();
    }
};

/**
 * Find all edges, optionally filtered by source/target nodes
 */
export const findAllEdges = async (from?: string, to?: string): Promise<Transaction[]> => {
    const session: Session = driver.session();
    const filters: string[] = [];
    const params: Record<string, any> = {};

    // Add filters dynamically based on parameters
    if (from) {
        filters.push('a.business_id = $from');
        params.from = from;
    }
    if (to) {
        filters.push('b.business_id = $to');
        params.to = to;
    }

    const query = `
        MATCH (a:Business)-[t:TRANSACTION]->(b:Business)
        ${filters.length ? 'WHERE ' + filters.join(' AND ') : ''}
        RETURN a.business_id AS from, b.business_id AS to, t.amount AS amount, t.timestamp AS timestamp
        ORDER BY t.timestamp DESC
    `;

    try {
        const result = await session.run(query, params);
        return result.records.map(record => ({
            from: record.get('from'),
            to: record.get('to'),
            amount: record.get('amount'),
            timestamp: record.get('timestamp')
        }));
    } finally {
        await session.close();
    }
};

/**
 * Get all nodes from the graph database
 */
export const getAllNodes = async (): Promise<GraphNode[]> => {
    const session: Session = driver.session();
    try {
        const result = await session.run(
            `
            MATCH (b:Business)
            RETURN b.business_id AS id
            `
        );

        return result.records.map(record => ({
            id: record.get('id')
        }));
    } catch (error) {
        console.error('Error fetching nodes:', (error as Error).message);
        throw error;
    } finally {
        await session.close();
    }
};

/**
 * Get all edges (visual representation of transactions) from the graph
 */
export const getAllEdges = async (): Promise<GraphEdge[]> => {
    const session: Session = driver.session();
    try {
        const result = await session.run(
            `
            MATCH (source:Business)-[t:TRANSACTION]->(target:Business)
            RETURN 
                source.business_id AS source, 
                target.business_id AS target, 
                count(t) AS transactionCount, 
                sum(t.amount) AS transactionAmount
            `
        );

        // Format the output with auto-incrementing IDs
        return result.records.map((record, index) => ({
            id: index + 1, // Auto-incrementing ID starting from 1
            source: record.get('source'),
            target: record.get('target'),
            transactionCount: record.get('transactionCount') ? parseInt(record.get('transactionCount'), 10) : 0,
            transactionAmount: record.get('transactionAmount') ? parseFloat(record.get('transactionAmount')) : 0
        }));
    } catch (error) {
        console.error('Error fetching edges:', (error as Error).message);
        throw error;
    } finally {
        await session.close();
    }
};

/**
 * Find filtered edges by various criteria using database-level filtering
 */
export const findFilteredEdges = async (
    from?: string,
    to?: string,
    startDate?: string,
    endDate?: string,
    minAmount?: string,
    maxAmount?: string
): Promise<Transaction[]> => {
    const session: Session = driver.session();
    const filters: string[] = [];
    const params: Record<string, any> = {};

    // Optional filters based on query parameters
    if (from) {
        filters.push('a.business_id = $from');
        params.from = from;
    }
    if (to) {
        filters.push('b.business_id = $to');
        params.to = to;
    }
    if (startDate) {
        filters.push('t.timestamp >= $startDate');
        params.startDate = startDate;
    }
    if (endDate) {
        filters.push('t.timestamp <= $endDate');
        params.endDate = endDate;
    }
    if (minAmount) {
        filters.push('t.amount >= $minAmount');
        params.minAmount = parseFloat(minAmount);
    }
    if (maxAmount) {
        filters.push('t.amount <= $maxAmount');
        params.maxAmount = parseFloat(maxAmount);
    }

    // Build the query dynamically based on provided filters
    const query = `
        MATCH (a:Business)-[t:TRANSACTION]->(b:Business)
        ${filters.length ? 'WHERE ' + filters.join(' AND ') : ''}
        RETURN a.business_id AS from, b.business_id AS to, t.amount AS amount, t.timestamp AS timestamp
        ORDER BY t.timestamp DESC
    `;

    try {
        const result = await session.run(query, params);
        return result.records.map(record => ({
            from: record.get('from'),
            to: record.get('to'),
            amount: record.get('amount'),
            timestamp: record.get('timestamp')
        }));
    } finally {
        await session.close();
    }
};

/**
 * Count edges for a specific node using database-level counting
 */
export const countEdgesByNode = async (businessId: string): Promise<number> => {
    const session: Session = driver.session();
    try {
        const result = await session.run(
            `
            MATCH (b:Business {business_id: $business_id})
            OPTIONAL MATCH (b)-[out:TRANSACTION]->() 
            OPTIONAL MATCH ()-[in:TRANSACTION]->(b)
            RETURN count(DISTINCT out) + count(DISTINCT in) AS transactionCount
            `,
            { business_id: businessId }
        );

        return result.records[0].get('transactionCount').toInt();
    } finally {
        await session.close();
    }
};