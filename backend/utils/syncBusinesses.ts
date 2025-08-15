import sqlite3 from 'sqlite3';
import * as graphRepo from '../repositories/graphRepository';
import path from 'path';

// Use environment variable for Docker, fallback to local path
const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../../database/sayari.db');

// Connect to SQLite database
const connectToSqlite = (): Promise<sqlite3.Database> => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error('Error connecting to SQLite database:', err.message);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database.');
      resolve(db);
    });
  });
};

interface BusinessRow {
  business_id: string;
}

// Fetch all businesses from SQLite and create them as nodes in Memgraph
export const syncBusinessesToMemgraph = async (): Promise<string> => {
  const sqliteDb = await connectToSqlite();
  
  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT business_id FROM businesses', async (err: Error | null, rows: BusinessRow[]) => {
      if (err) {
        console.error('Error querying SQLite database:', err.message);
        sqliteDb.close();
        reject(err);
        return;
      }

      console.log(`Found ${rows.length} businesses. Syncing to Memgraph...`);

      try {
        for (const row of rows) {
          try {
            await graphRepo.createOrFindNode(row.business_id);
            console.log(`Created node in Memgraph: (${row.business_id})`);
          } catch (error) {
            console.error(`Error creating node for ${row.business_id}:`, (error as Error).message);
          }
        }
        
        console.log('Sync completed.');
        sqliteDb.close(() => console.log('SQLite database connection closed.'));
        resolve('Sync completed successfully');
      } catch (error) {
        sqliteDb.close();
        reject(error);
      }
    });
  });
};

// Only run the sync if this file is executed directly
if (require.main === module) {
  syncBusinessesToMemgraph()
    .then(() => console.log('Process completed'))
    .catch(err => console.error('Error during sync process:', err));
}