import { FastifyInstance } from 'fastify';
import { pool } from '../db/db';

let apiRequestCounter: Record<string, number> = {};

// Expressive middleware hook to count request endpoints for telemetry
export function instrumentTelemetry(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    const key = `${request.method}:${request.routerPath || request.url}`;
    apiRequestCounter[key] = (apiRequestCounter[key] || 0) + 1;
  });
}

export async function telemetryRoutes(fastify: FastifyInstance) {
  // 1. HEALTH LIVENESS PROBE
  fastify.get('/health/live', async (request, reply) => {
    return reply.send({ status: 'UP', timestamp: new Date().toISOString() });
  });

  // 2. HEALTH READINESS PROBE
  fastify.get('/health/ready', async (request, reply) => {
    try {
      // Test database connection
      const dbCheck = await pool.query('SELECT 1');
      if (dbCheck.rows.length > 0) {
        return reply.send({ status: 'UP', database: 'CONNECTED', timestamp: new Date().toISOString() });
      }
      throw new Error('Database ping failed');
    } catch (err) {
      console.error('Readiness health check failed:', err);
      return reply.status(503).send({ status: 'DOWN', database: 'DISCONNECTED', error: (err as Error).message });
    }
  });

  // 3. PROMETHEUS METRICS ENDPOINT Exposing text counters
  fastify.get('/metrics', async (request, reply) => {
    try {
      const dbStats = pool;
      const activeConnections = dbStats.totalCount;
      const idleConnections = dbStats.idleCount;

      let metricsText = '';

      metricsText += '# HELP tradesphere_api_requests_total Total API request counts\n';
      metricsText += '# TYPE tradesphere_api_requests_total counter\n';
      for (const [route, count] of Object.entries(apiRequestCounter)) {
        const [method, path] = route.split(':');
        metricsText += `tradesphere_api_requests_total{method="${method}",path="${path}"} ${count}\n`;
      }

      metricsText += '\n# HELP tradesphere_db_connections_active Number of active DB pool clients\n';
      metricsText += '# TYPE tradesphere_db_connections_active gauge\n';
      metricsText += `tradesphere_db_connections_active ${activeConnections - idleConnections}\n`;

      metricsText += '\n# HELP tradesphere_db_connections_idle Number of idle DB pool clients\n';
      metricsText += '# TYPE tradesphere_db_connections_idle gauge\n';
      metricsText += `tradesphere_db_connections_idle ${idleConnections}\n`;

      metricsText += '\n# HELP tradesphere_memory_usage_bytes Node process memory usage\n';
      metricsText += '# TYPE tradesphere_memory_usage_bytes gauge\n';
      const memory = process.memoryUsage();
      metricsText += `tradesphere_memory_usage_bytes{type="rss"} ${memory.rss}\n`;
      metricsText += `tradesphere_memory_usage_bytes{type="heapTotal"} ${memory.heapTotal}\n`;
      metricsText += `tradesphere_memory_usage_bytes{type="heapUsed"} ${memory.heapUsed}\n`;

      reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      return reply.send(metricsText);
    } catch (err) {
      return reply.status(500).send('Error compiling telemetry reports');
    }
  });
}
