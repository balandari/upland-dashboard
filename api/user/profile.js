import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = req.headers['x-session-id'];
  if (!sessionId) {
    return res.status(401).json({ error: 'Missing session' });
  }

  try {
    const raw = await redis.get('session:' + sessionId);
    if (!raw) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!session.accessToken) {
      return res.status(401).json({ error: 'Not connected' });
    }

    const uplandRes = await fetch('https://api.prod.upland.me/developers-api/user/profile', {
      headers: { 'Authorization': 'Bearer ' + session.accessToken }
    });

    if (!uplandRes.ok) {
      return res.status(502).json({ error: 'Upland API error: ' + uplandRes.status });
    }

    const data = await uplandRes.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal error: ' + err.message });
  }
}
