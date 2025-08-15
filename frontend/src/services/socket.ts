import { io, Socket } from 'socket.io-client';

// Create a single socket instance to be shared across components
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Use a global to ensure true singleton across HMR and StrictMode
const globalKey = '__APP_SOCKET__' as const;

// Check if socket already exists on window object
let socket: Socket;

if (typeof window !== 'undefined') {
  if (!(window as any)[globalKey]) {
    socket = io(apiUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      autoConnect: false, // Don't auto-connect, we'll do it manually
      transports: ['websocket'], // Use only WebSocket transport for real-time performance
    });

    socket.on('connect', () => {
      console.log('WebSocket connected:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
    });

    // Store on window to persist across HMR
    (window as any)[globalKey] = socket;
  } else {
    console.log('Reusing existing WebSocket connection');
    socket = (window as any)[globalKey];
  }
} else {
  // Server-side rendering or non-browser environment
  // Create a dummy socket that won't actually connect
  socket = {} as Socket;
}

let connectPromise: Promise<Socket> | null = null;

export const getSocket = (): Socket => {
  // Guard against non-browser environments
  if (!socket || typeof window === 'undefined') {
    return socket;
  }
  
  // If already connected, just return the socket
  if (socket.connected) {
    return socket;
  }
  
  // If currently connecting, wait for that connection
  // Check if socket is disconnected (not connected and not undefined)
  if (!socket.disconnected) {
    return socket;
  }
  
  // If not connected and not connecting, start connection
  if (!connectPromise) {
    console.log('Initiating WebSocket connection...');
    socket.connect();
    connectPromise = new Promise((resolve) => {
      socket.once('connect', () => {
        console.log('WebSocket connection established');
        connectPromise = null;
        resolve(socket);
      });
    });
  }
  
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};