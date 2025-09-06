import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// Use environment variable for Docker, fallback to local path
const dbPath =
  process.env.DATABASE_PATH ||
  path.resolve(__dirname, '../../database/sayari.db');

interface Business {
  name: string;
  industry: string;
}

const businesses: Business[] = [
  /*{ name: "Global Tech Solutions", industry: "Technology" },
  { name: "Apex Industries", industry: "Manufacturing" },
  { name: "Blue Harbor Logistics", industry: "Logistics" },
  { name: "Catalyst Consulting", industry: "Consulting" },*/
  { name: 'Digital Dynamics', industry: 'Software Development' },
  { name: 'Eclipse Software', industry: 'Software Development' },
  { name: 'Fusion Financial', industry: 'Financial Services' },
  { name: 'Green Valley Foods', industry: 'Food Production' },
  { name: 'Highland Manufacturing', industry: 'Manufacturing' },
  { name: 'Innovation Labs', industry: 'Technology' },
  { name: 'Jupiter Electronics', industry: 'Electronics' },
  { name: 'Kinetic Energy Corp', industry: 'Energy' },
];

export function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('Using database at:', dbPath);
    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      // Create table
      db.run(
        `
        CREATE TABLE IF NOT EXISTS businesses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          business_id TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          industry TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `,
        (err: Error | null) => {
          if (err) {
            console.error('Error creating table:', err);
            reject(err);
            return;
          }
          console.log('Table created or already exists.');
        }
      );

      // Clear existing data
      db.run(`DELETE FROM businesses`, (err: Error | null) => {
        if (err) {
          console.error('Error clearing businesses table:', err.message);
          reject(err);
          return;
        }
        console.log('Cleared existing businesses data.');

        // Insert new data
        const stmt = db.prepare(`
          INSERT INTO businesses (business_id, name, industry)
          VALUES (?, ?, ?)
        `);

        let insertCount = 0;
        const totalBusinesses = businesses.length;

        businesses.forEach((business) => {
          const uuid = uuidv4();
          stmt.run(
            uuid,
            business.name,
            business.industry,
            (err: Error | null) => {
              if (err) {
                console.error(
                  `Error inserting business ${business.name}:`,
                  err.message
                );
              } else {
                console.log(
                  `Inserted business: ${business.name}, Industry: ${business.industry}, UUID: ${uuid}`
                );
              }

              insertCount++;
              // Resolve when all businesses are inserted
              if (insertCount === totalBusinesses) {
                db.close(() => {
                  console.log('Database initialization complete.');
                  resolve();
                });
              }
            }
          );
        });

        stmt.finalize();
      });

      db.run(
        `
            CREATE TABLE IF NOT EXISTS alerts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              type TEXT NOT NULL,
              severity TEXT NOT NULL,
              from_business_id TEXT NOT NULL,
              to_business_id TEXT NOT NULL,
              amount REAL NOT NULL,
              timestamp TEXT NOT NULL
            );
          `,
        (err: Error | null) => {
          if (err) {
            console.error('Error creating alerts table:', err);
            reject(err);
            return;
          }
          console.log('Alerts table created or already exists.');
        }
      );

      // Clear alerts
      db.run(`DELETE FROM alerts`, (err: Error | null) => {
        if (err) {
          console.error('Error clearing alerts table:', err.message);
          reject(err);
          return;
        }
        console.log('Cleared existing alerts data.');
      });
    });
  });
}
