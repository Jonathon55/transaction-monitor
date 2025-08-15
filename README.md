# Business Transaction Monitoring Application

## Overview

This is an example real-time business transaction monitoring application that visualizes financial transactions between businesses. The application displays transaction data in both tabular and graph formats, providing insights into business relationships and transaction patterns.

## Features

- **Real-time Transaction Monitoring**: View transactions as they happen with live updates via WebSocket connections
- **Business Overview**: See all businesses with their industries and transaction counts
- **Transaction Details**: Detailed view of all transactions including sender, receiver, amount, and timestamp
- **Visual Graph**: Interactive graph visualization showing business relationships and transaction flows
- **Search and Filtering**: Search through transactions and sort by various criteria

## User Stories

Please check the **Issues** section of this GitHub repository for the user stories to be implemented as part of this assessment.

## Architecture

The application consists of:
- **Frontend**: React application with Material-UI components
- **Backend**: Node.js/Express API server
- **Databases**: 
  - SQLite for business metadata (name, industry)
  - Memgraph (Neo4j-compatible) for transaction graph data
- **Transaction Simulator**: Optional service that generates sample transactions

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm

### Running with Docker Compose (Recommended)

```bash
# Rebuild and start all services
docker compose down
docker compose up -d --build
```

Services will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Memgraph: bolt://localhost:7687

### Running Services Locally (Alternative)

#### 1. Start Memgraph in Docker

```bash
docker run -d -p 7687:7687 --name memgraph memgraph/memgraph
```

#### 2. Start Backend

```bash
cd backend
npm install
npm run dev
```
Backend runs on http://localhost:3000

#### 3. Start Frontend

```bash
cd frontend
npm install  
npm run dev
```
Frontend runs on http://localhost:5173

#### 4. Start Transaction Simulator (optional)

```bash
cd transaction_simulator
npm install
npm run dev
```

## Development Notes

### API Endpoints

The backend provides the following key endpoints:
- `GET /api/businesses` - List all businesses
- `GET /api/businesses/transactions` - Get all transactions
- `POST /api/transactions` - Create a new transaction
- `GET /api/businesses/:id/transaction-count` - Get transaction count for a business

### Database Schema

**SQLite (Business Data)**:
- `businesses` table: `business_id`, `name`, `industry`

**Memgraph (Transaction Graph)**:
- Nodes: `Business` with `business_id` property
- Edges: `TRANSACTION` with `amount` and `timestamp` properties

## Troubleshooting

If services can't connect:
1. Check that Memgraph is running: `docker ps | grep memgraph`
2. Verify ports aren't already in use: `lsof -i :3000` or `lsof -i :7687`
3. Check .env files exist in each service directory
4. For Docker: rebuild with `docker compose build --no-cache`

## Assessment Guidelines

- Focus on code quality, maintainability, and best practices
- Consider performance implications of your solutions
- Be prepared to discuss your implementation choices
- Time expectation: 4-6 hours
- Remember to check the Issues section for the specific user stories to implement