import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

const UPLAND_API = 'https://api.prod.upland.me/developers-api';

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

    // Auto-paginate: fetch all pages
    const allResults = [];
    let currentPage = 1;
    let totalResults = 0;

    while (true) {
      const url = UPLAND_API + '/user/assets/properties?page=' + currentPage;
      const uplandRes = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + session.accessToken }
      });

      if (!uplandRes.ok) {
        return res.status(502).json({ error: 'Upland API error: ' + uplandRes.status });
      }

      const data = await uplandRes.json();
      totalResults = data.totalResults || totalResults;

      if (data.results && data.results.length > 0) {
        allResults.push(...data.results);
      }

      // Stop if we have all results or no more pages
      if (!data.results || data.results.length === 0 || allResults.length >= totalResults) {
        break;
      }

      currentPage++;

      // Safety limit to prevent infinite loops
      if (currentPage > 100) break;
    }

    return res.status(200).json({
      results: allResults,
      totalResults: totalResults
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error: ' + err.message });
  }
}
