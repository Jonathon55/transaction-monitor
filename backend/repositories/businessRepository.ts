import sqlite3 from 'sqlite3';
import path from 'path';
import { Business } from '../types';

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../../database/sayari.db');

/**
 * Find all businesses
 */
export const findAllBusinesses = async (): Promise<Business[]> => {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);
        db.all('SELECT * FROM businesses', (err, rows) => {
            db.close();
            if (err) reject(err);
            else resolve(rows as Business[]);
        });
    });
};

/**
 * Find a business by ID
 */
export const findBusinessById = async (businessId: string): Promise<Business | null> => {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);
        db.get('SELECT * FROM businesses WHERE business_id = ?', [businessId], (err, row) => {
            db.close();
            if (err) reject(err);
            else resolve(row as Business | null);
        });
    });
};

/**
 * Create a new business
 */
export const createBusiness = async (businessId: string, name: string, industry: string): Promise<{ id: number }> => {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);
        db.run(
            'INSERT INTO businesses (business_id, name, industry) VALUES (?, ?, ?)',
            [businessId, name, industry],
            function(err) {
                db.close();
                if (err) reject(err);
                else resolve({ id: this.lastID });
            }
        );
    });
};

/**
 * Get business details for multiple IDs
 */
export const getBusinessDetails = async (businessIds: string[]): Promise<{ 
    nameMap: Record<string, string>; 
    industryMap: Record<string, string> 
}> => {
    if (!businessIds || businessIds.length === 0) {
        return { nameMap: {}, industryMap: {} };
    }

    const placeholders = businessIds.map(() => '?').join(',');
    const sql = `SELECT business_id, name, industry FROM businesses WHERE business_id IN (${placeholders})`;
    
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);
        db.all(sql, businessIds, (err, rows: any[]) => {
            db.close();
            if (err) {
                reject(err);
            } else {
                const nameMap: Record<string, string> = {};
                const industryMap: Record<string, string> = {};
                
                rows.forEach(row => {
                    nameMap[row.business_id] = row.name;
                    industryMap[row.business_id] = row.industry;
                });
                
                resolve({ nameMap, industryMap });
            }
        });
    });
};