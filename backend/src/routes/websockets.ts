import { FastifyInstance } from 'fastify';
import { RawData, WebSocket } from 'ws';
import { feedEvents, getLatestPrices, TickerPrice } from '../engine/liveFeeds.js';

const clients = new Set<WebSocket>();

export async function websocketRoutes(fastify: FastifyInstance) {
  // Register /ws endpoint
  fastify.get('/ws', { websocket: true }, (connection: any, req) => {
    const socket = connection.socket;
    clients.add(socket);
    console.log(`WebSocket client connected. Total clients: ${clients.size}`);

    // Send latest prices immediately upon connection
    const currentPrices = getLatestPrices();
    socket.send(JSON.stringify({ type: 'snapshot', data: currentPrices }));

    // Keep connection alive with ping-pong
    const pingInterval = setInterval(() => {
      if (socket.readyState === socket.OPEN) {
        socket.ping();
      }
    }, 30000);

    socket.on('message', (message: RawData) => {
      try {
        const parsed = JSON.parse(message.toString());
        // Handle client messages if any are sent
        if (parsed.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (err) {
        // Ignore malformed messages
      }
    });

    socket.on('close', () => {
      clients.delete(socket);
      clearInterval(pingInterval);
      console.log(`WebSocket client disconnected. Total clients: ${clients.size}`);
    });

    socket.on('error', (err: any) => {
      console.error('WebSocket client error:', err.message);
      clients.delete(socket);
      clearInterval(pingInterval);
    });
  });
}

// Broadcast tick to all connected clients
feedEvents.on('tick', (tick: TickerPrice) => {
  const message = JSON.stringify({ type: 'tick', data: tick });
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error('Failed to send tick to socket client:', err);
      }
    }
  }
});
