import { config } from '../config';

let redisClient: RedisClient | null = null;

type RedisClient = InstanceType<typeof Bun.RedisClient>;

function createRedisClient(): RedisClient | null {
  const redisUrl = config.REDIS_URL?.trim();
  if (!redisUrl) {
    return null;
  }

  return new Bun.RedisClient(redisUrl);
}

export function getRedisClient(): RedisClient | null {
  if (redisClient) {
    return redisClient;
  }

  redisClient = createRedisClient();
  return redisClient;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  if (!client || client.connected) {
    return;
  }

  try {
    await client.connect();
  } catch (error) {
    console.warn('[redis] failed to connect, continuing with in-memory fallback', error);
  }
}

export function isRedisConfigured(): boolean {
  return Boolean(config.REDIS_URL?.trim());
}
