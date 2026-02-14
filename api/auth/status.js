import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = req.query.sessionId;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  try {
    const raw = await redis.get('session:' + sessionId);
    if (!raw) {
      return res.status(404).json({ status: 'expired' });
    }

    const session = typeof raw === 'string' ? JSON.parse(raw) : raw;

    // Never expose accessToken to frontend
    return res.status(200).json({
      status: session.status,
      username: session.username || null,
      error: session.error || null
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error: ' + err.message });
  }
}
