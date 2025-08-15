require('dotenv').config();
const axios = require('axios');

// Retrieve the API URL from environment variables
const API_URL = process.env.API_URL;

// Function to pick two unique random business IDs from the provided list
function getRandomBusinessPair(businessIds) {
    if (businessIds.length < 2) {
        throw new Error("Need at least two business IDs to generate a transaction.");
    }
    const [from, to] = businessIds
        .sort(() => 0.5 - Math.random()) // Shuffle array
        .slice(0, 2); // Pick two unique IDs
    return [from, to];
}

// Function to generate a random transaction amount
function getRandomAmount() {
    return Math.floor(Math.random() * 100000) + 1000; // Between 1,000 and 100,000
}

// Function to create and send a transaction to the backend
async function generateTransaction(businessIds) {
    const [from, to] = getRandomBusinessPair(businessIds);
    const amount = getRandomAmount();
    const timestamp = new Date().toISOString();

    try {
        const response = await axios.post(API_URL, {
            from,
            to,
            amount,
            timestamp
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`Transaction created: ${JSON.stringify(response.data)}`);
    } catch (error) {
        console.error(`Error creating transaction: ${error.message}`);
    }
}

// Main function to start generating transactions between businesses in separate groups
function startTransactionSimulator(businessGroups, interval) {
    console.log(`Starting transaction simulator with interval ${interval} ms...`);
    
    // Counter to track the number of transactions
    let transactionCount = 0;
    const MAX_TRANSACTIONS = 50; // Total transactions across all groups
    const TRANSACTIONS_PER_GROUP = MAX_TRANSACTIONS / businessGroups.length;
    
    businessGroups.forEach((group, index) => {
        console.log(`Group ${index + 1} has ${group.length} businesses: ${group.join(', ')}`);
    });
    
    // Create interval for transactions
    const intervalId = setInterval(() => {
        // Determine which group to generate a transaction for (alternating)
        const groupIndex = transactionCount % businessGroups.length;
        const currentGroup = businessGroups[groupIndex];
        
        // Only generate transaction if the group has at least 2 businesses
        if (currentGroup.length >= 2) {
            // Generate transaction within this group only
            generateTransaction(currentGroup);
            transactionCount++;
            
            if (transactionCount % 10 === 0) {
                console.log(`Generated ${transactionCount} of ${MAX_TRANSACTIONS} transactions`);
            }
            
            // Stop after reaching the limit
            if (transactionCount >= MAX_TRANSACTIONS) {
                clearInterval(intervalId);
                console.log(`Transaction simulation complete. Generated ${MAX_TRANSACTIONS} transactions.`);
            }
        } else {
            console.log(`Group ${groupIndex + 1} has fewer than 2 businesses, skipping...`);
            transactionCount++;
        }
    }, interval);
    
    console.log(`Will generate a maximum of ${MAX_TRANSACTIONS} transactions (${TRANSACTIONS_PER_GROUP} per group)`);
}

module.exports = { startTransactionSimulator };
