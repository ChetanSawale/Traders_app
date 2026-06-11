import Redis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;
let redisClient: Redis | null = null;
const memoryCache = new Map<string, { value: string; expireAt: number }>();

try {
  if (redisUrl) {
    redisClient = new Redis(redisUrl);
    console.log('Redis initialized with URL.');
  } else {
    // Attempt local default Redis
    redisClient = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: 1,
    });
    console.log('Redis initialized with default settings.');
  }

  redisClient.on('error', (err) => {
    console.warn('Redis Connection Error - falling back to in-memory cache:', err.message);
  });
} catch (e) {
  console.warn('Redis failed to initialize - using in-memory cache fallback.');
}

export const cache = {
  async get(key: string): Promise<string | null> {
    if (redisClient && redisClient.status === 'ready') {
      try {
        return await redisClient.get(key);
      } catch (err) {
        // Fallback
      }
    }
    const item = memoryCache.get(key);
    if (item) {
      if (Date.now() < item.expireAt) {
        return item.value;
      }
      memoryCache.delete(key);
    }
    return null;
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (redisClient && redisClient.status === 'ready') {
      try {
        if (ttlSeconds) {
          await redisClient.set(key, value, 'EX', ttlSeconds);
        } else {
          await redisClient.set(key, value);
        }
        return;
      } catch (err) {
        // Fallback
      }
    }
    const expireAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity;
    memoryCache.set(key, { value, expireAt });
  },

  async del(key: string): Promise<void> {
    if (redisClient && redisClient.status === 'ready') {
      try {
        await redisClient.del(key);
        return;
      } catch (err) {
        // Fallback
      }
    }
    memoryCache.delete(key);
  }
};
