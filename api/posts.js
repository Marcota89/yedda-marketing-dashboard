export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
};

const SUPABASE_URL = 'https://mxjlvgzmjmnltfzcwfsh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14amx2Z3ptam1ubHRmemN3ZnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4OTM4MzAsImV4cCI6MjA5MjQ2OTgzMH0.eurPDN8iGug8jYRxKsUgxvjtJ88jRexUMoQb7lgpSAY';

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET ?stats=1 — distribution by vertical and by source over the last N days.
  // "Not much variety" was an opinion until this existed; now it is a number,
  // and the weekly query rotation can weight toward the least-covered vertical.
  if (req.method === 'GET' && (req.query || {}).stats) {
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/marketing_posts?select=post_data,created_at&created_at=gte.${since}&order=created_at.desc&limit=500`,
      { headers: HEADERS }
    );
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });
    const byVertical = {}, bySource = {}, byOrigin = {};
    let total = 0;
    for (const row of data) {
      const p = row.post_data || {};
      total++;
      const v = p._vertical || (p.meta && p.meta.vertical) || 'unknown';
      byVertical[v] = (byVertical[v] || 0) + 1;
      const src = String(p.src || '').split('·')[0].trim() || 'unknown';
      bySource[src] = (bySource[src] || 0) + 1;
      const o = p._source || 'platform';
      byOrigin[o] = (byOrigin[o] || 0) + 1;
    }
    const repeated = Object.entries(bySource).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
    res.setHeader('Cache-Control', 'public, max-age=120');
    return res.status(200).json({
      days, total,
      by_vertical: byVertical,
      by_origin: byOrigin,
      distinct_sources: Object.keys(bySource).length,
      repeated_sources: repeated.slice(0, 10).map(([s, n]) => ({ source: s, posts: n })),
      repeat_ratio: total ? +(1 - Object.keys(bySource).length / total).toFixed(3) : 0,
    });
  }

  // GET — return all posts (including images) ordered by creation date
  if (req.method === 'GET') {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/marketing_posts?select=post_data&order=created_at.asc`,
      { headers: HEADERS }
    );
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });
    return res.status(200).json(data.map(row => row.post_data));
  }

  // POST — upsert one or more posts (full post_data including _image)
  if (req.method === 'POST') {
    const { posts } = req.body || {};
    if (!posts || !Array.isArray(posts) || !posts.length)
      return res.status(400).json({ error: 'posts array required' });

    const rows = posts
      .filter(p => p && p._id)
      .map(p => ({
        post_id: p._id,
        post_data: p,
        updated_at: new Date().toISOString(),
      }));

    if (!rows.length) return res.status(400).json({ error: 'no valid posts (missing _id)' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/marketing_posts`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(rows),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: err });
    }
    return res.status(200).json({ ok: true, count: rows.length });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
