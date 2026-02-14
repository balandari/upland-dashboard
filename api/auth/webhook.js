import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN
});

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret) {
    const token = req.headers['x-webhook-token'] || req.body?.accessToken;
    if (token !== webhookSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { type, data, message } = req.body || {};

  // Upland sends a validation call when registering the webhook URL
  if (!type && message) {
    return res.status(200).json({ ok: true });
  }

  if (!type) {
    return res.status(400).json({ error: 'Missing event type' });
  }

  try {
    if (type === 'AuthenticationSuccess') {
      const accessToken = data?.accessToken;
      const userId = data?.userId;
      const code = data?.code;

      if (!accessToken || !code) {
        return res.status(400).json({ error: 'Missing token or code' });
      }

      // Find session by code
      const keys = await redis.keys('session:*');
      let matchedKey = null;

      for (const key of keys) {
        const raw = await redis.get(key);
        const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (session && session.code === code && session.status === 'pending') {
          matchedKey = key;
          break;
        }
      }

      if (!matchedKey) {
        return res.status(404).json({ error: 'No pending session for code' });
      }

      await redis.set(matchedKey, JSON.stringify({
        status: 'connected',
        accessToken: accessToken,
        userId: userId,
        code: code,
        connectedAt: Date.now()
      }), { ex: THIRTY_DAYS });

      return res.status(200).json({ ok: true });
    }

    if (type === 'AuthenticationFailure') {
      const code = data?.code;
      const message = data?.message || 'Authentication failed';

      if (code) {
        const keys = await redis.keys('session:*');
        for (const key of keys) {
          const raw = await redis.get(key);
          const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (session && session.code === code) {
            await redis.set(key, JSON.stringify({
              ...session,
              status: 'failed',
              error: message
            }), { ex: 600 });
            break;
          }
        }
      }

      return res.status(200).json({ ok: true });
    }

    if (type === 'UserDisconnectedApplication') {
      const userId = data?.userId;

      if (userId) {
        const keys = await redis.keys('session:*');
        for (const key of keys) {
          const raw = await redis.get(key);
          const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (session && session.userId === userId) {
            await redis.del(key);
            break;
          }
        }
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true, ignored: type });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error: ' + err.message });
  }
}
