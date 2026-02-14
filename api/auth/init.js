import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appId = process.env.UPLAND_APP_ID;
  const appSecret = process.env.UPLAND_APP_SECRET;

  if (!appId || !appSecret) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    const credentials = Buffer.from(appId + ':' + appSecret).toString('base64');

    const uplandRes = await fetch('https://api.prod.upland.me/developers-api/auth/otp/init', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + credentials,
        'Content-Type': 'application/json'
      }
    });

    if (!uplandRes.ok) {
      const text = await uplandRes.text();
      return res.status(502).json({ error: 'Upland API error: ' + uplandRes.status, detail: text });
    }

    const data = await uplandRes.json();
    const sessionId = randomUUID();

    await redis.set('session:' + sessionId, JSON.stringify({
      code: data.code,
      status: 'pending',
      created: Date.now()
    }), { ex: 600 });

    return res.status(200).json({ sessionId: sessionId, code: data.code });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error: ' + err.message });
  }
}
