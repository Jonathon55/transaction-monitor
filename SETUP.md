## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm

### Running with Docker Compose

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

#### 4. Start Transaction Simulator (to receive transaction data)

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
