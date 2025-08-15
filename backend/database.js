const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create and connect to the SQLite database
// Use environment variable for Docker, fallback to local path
const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../database/sayari.db');
const db = new sqlite3.Database(dbPath);

module.exports = db;
