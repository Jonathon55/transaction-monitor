import sqlite3 from 'sqlite3';
import path from 'path';
import { Alert } from '../types';

const dbPath =
  process.env.DATABASE_PATH ||
  path.resolve(__dirname, '../../database/sayari.db');

const ensureTable = async (): Promise<void> => {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);
  await new Promise<void>((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        from_business_id TEXT NOT NULL,
        to_business_id TEXT NOT NULL,
        amount REAL NOT NULL,
        timestamp TEXT NOT NULL
      )`,
      (err) => (err ? reject(err) : resolve())
    );
  });
  db.close();
};

// Insert one alert and return row id
export const insertAlert = async (alert: Alert): Promise<number> => {
  await ensureTable();
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);
  return await new Promise<number>((resolve, reject) => {
    db.run(
      `INSERT INTO alerts (type, severity, from_business_id, to_business_id, amount, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        alert.type,
        alert.severity,
        alert.from,
        alert.to,
        alert.amount,
        alert.timestamp,
      ],
      function (err) {
        db.close();
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

// Optional helper (not used yet) to get recent alerts
export const findRecentAlerts = async (limit = 50): Promise<Alert[]> => {
  await ensureTable();
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);
  return await new Promise<Alert[]>((resolve, reject) => {
    db.all(
      `SELECT id,
              type,
              severity,
              from_business_id AS "from",
              to_business_id   AS "to",
              amount,
              timestamp
       FROM alerts
       ORDER BY id DESC
       LIMIT ?`,
      [limit],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else resolve(rows as Alert[]);
      }
    );
  });
};
