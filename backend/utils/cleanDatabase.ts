import neo4j from 'neo4j-driver';

const MEMGRAPH_URL = process.env.MEMGRAPH_URL || 'bolt://localhost:7687';

export async function clearMemgraphData(): Promise<void> {
    const driver = neo4j.driver(MEMGRAPH_URL, neo4j.auth.basic('', ''));
    const session = driver.session();
    
    try {
        // Delete all relationships first, then all nodes
        await session.run('MATCH ()-[r]->() DELETE r');
        console.log('Cleared all Memgraph relationships');
        
        await session.run('MATCH (n) DELETE n');
        console.log('Cleared all Memgraph nodes');
    } catch (error) {
        console.error('Error clearing Memgraph data:', error);
        throw error;
    } finally {
        await session.close();
        await driver.close();
    }
}