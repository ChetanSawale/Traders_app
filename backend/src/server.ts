import fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import { initDatabase } from './db/db.js';
import { startLiveFeeds, stopLiveFeeds } from './engine/liveFeeds.js';
import { startMatchingEngine } from './engine/matching.js';
import { authRoutes } from './routes/auth.js';
import { tradingRoutes } from './routes/trading.js';
import { newsRoutes } from './routes/news.js';
import { educationRoutes } from './routes/education.js';
import { telemetryRoutes, instrumentTelemetry } from './routes/telemetry.js';
import { websocketRoutes } from './routes/websockets.js';
import * as dotenv from 'dotenv';

dotenv.config();

const server = fastify({
  logger: {
    level: 'info',
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
  },
});

// Configure Middlewares
server.register(fastifyCors, {
  origin: true, // Allow frontend origin dynamically
  credentials: true,
});

server.register(fastifyCookie, {
  secret: process.env.COOKIE_SECRET || 'cookie-secret-key-12345',
});

server.register(fastifyWebsocket);

// Instrument request metrics
instrumentTelemetry(server);

// Health check for Render / load balancers (no auth, no DB touch)
server.get('/health', async () => ({ status: 'ok' }));

// Register Route Handlers
server.register(authRoutes);
server.register(tradingRoutes);
server.register(newsRoutes);
server.register(educationRoutes);
server.register(telemetryRoutes);
server.register(websocketRoutes);

// Graceful Shutdown Handler
const shutdown = async () => {
  server.log.info('Received shutdown signal. Stopping background tickers...');
  stopLiveFeeds();
  await server.close();
  server.log.info('Server closed. Exiting process.');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function start() {
  try {
    // 1. Initialize PostgreSQL database and tables
    await initDatabase();

    // 2. Start Live Market Tick Collector Feed
    startLiveFeeds(2000); // Poll feed every 2 seconds

    // 3. Start Order Matching listener
    startMatchingEngine();

    // 4. Bind Server
    const port = Number(process.env.PORT) || 3001;
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    server.log.info(`TradeSphere Backend running at http://localhost:${port}`);
  } catch (err) {
    server.log.error(err, 'Error starting TradeSphere backend');
    process.exit(1);
  }
}

start();
