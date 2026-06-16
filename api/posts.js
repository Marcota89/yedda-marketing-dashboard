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
