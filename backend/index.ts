import 'dotenv/config';
import { syncBusinessesToMemgraph } from './utils/syncBusinesses';
import { clearMemgraphData } from './utils/cleanDatabase';
import { initializeDatabase } from './utils/initDatabase';
import { emitInitialGraph } from './services/notificationService';
import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import { Server, Socket } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.send('Hello, Sayari!');
});

// Store the socket.io instance for use in routes
app.set('io', io);

import { router as businessesRoute } from './routes/businesses';
app.use('/api/businesses', businessesRoute);

import transactionsRoute from './routes/transactions';
app.use('/api/transactions', transactionsRoute);

// WebSocket connection handling
io.on('connection', (socket: Socket) => {
  console.log('Client connected:', socket.id);

  const sendInitialData = async () => {
    try {
      await emitInitialGraph(socket);
    } catch (error) {
      console.error('Error sending initial data:', error);
    }
  };

  sendInitialData();

  // NEW: allow clients to ask for a fresh snapshot any time
  socket.on('requestInitialGraph', async () => {
    try {
      await emitInitialGraph(socket);
    } catch (error) {
      console.error('Error sending snapshot:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Clean and reseed data on server start
  try {
    console.log('Cleaning databases on server start...');

    // 1. Clear Memgraph
    await clearMemgraphData();

    // 2. Initialize SQLite with fresh data
    await initializeDatabase();

    // 3. Sync SQLite data to Memgraph
    await syncBusinessesToMemgraph();

    console.log('Database cleaned and reseeded successfully');
  } catch (error) {
    console.error('Error during database initialization:', error);
  }
});
