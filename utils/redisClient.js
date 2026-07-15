/**
 * Shared Redis client (ioredis).
 * @module utils/redisClient
 */

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('Redis error:', err.message);
});

export default redis;
