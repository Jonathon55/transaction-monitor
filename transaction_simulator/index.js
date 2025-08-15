const sqlite3 = require('sqlite3').verbose();
const { startTransactionSimulator } = require('./simulator');
const path = require('path');

// Use environment variable for Docker, fallback to local path
const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../database/sayari.db');
console.log('Attempting to load database module from:', dbPath);

let db;
try {
    db = new sqlite3.Database(dbPath);
} catch (err) {
    console.error('Failed to load database module:', err);
    process.exit(1);
}

const getAllBusinessIds = () => {
    return new Promise((resolve, reject) => {
        const query = `SELECT business_id FROM businesses`;
        db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            const businessIds = rows.map(row => row.business_id);
            console.log('Business IDs from database:', businessIds);
            resolve(businessIds);
        });
    });
};

// Wait for backend to initialize database before starting
console.log('Waiting 5 seconds for backend to initialize database...');
setTimeout(() => {
    // Start the simulator with businesses split into two groups
    getAllBusinessIds()
        .then(allBusinessIds => {
            const interval = 4000;
            console.log(`Loaded ${allBusinessIds.length} total businesses`);
        
        // Shuffle all business IDs
        const shuffled = [...allBusinessIds].sort(() => 0.5 - Math.random());
        
        // Select half of the businesses for the simulation
        const totalBusinessesToUse = Math.min(allBusinessIds.length, 12); // Use up to 12 businesses total
        const activeBusinessIds = shuffled.slice(0, totalBusinessesToUse);
        
        // Split the active businesses into two equal groups
        const halfwayPoint = Math.floor(activeBusinessIds.length / 2);
        const group1 = activeBusinessIds.slice(0, halfwayPoint);
        const group2 = activeBusinessIds.slice(halfwayPoint);
        
        console.log(`Split ${activeBusinessIds.length} businesses into two groups`);
        console.log(`Group 1: ${group1.length} businesses`);
        console.log(`Group 2: ${group2.length} businesses`);
        
        // Create a simulator that understands the two groups
        // Businesses will only transact within their own group
        startTransactionSimulator([group1, group2], interval);
    })
        .catch(err => {
            console.error('Error fetching business IDs:', err);
            process.exit(1);
        });
}, 5000);