// Vercel serverless — Roi's personal LinkedIn post queue.
//
// The dashboard queues posts here; the PhantomBuster LinkedIn Auto Poster reads
// ONLY the approved ones as a CSV feed and publishes them to Roi's profile.
//
// GET  /api/roi-posts                 → JSON list (dashboard)
// GET  /api/roi-posts?format=csv      → CSV feed for the Auto Poster (approved only)
// POST /api/roi-posts                 → queue a post  { post_text, post_type, status? }
// POST /api/roi-posts {action:'webhook'} OR PhantomBuster resultObject → mark posted
// PATCH /api/roi-posts                → { id, status } approve / archive / mark posted
//
// SAFETY: the CSV feed only ever exposes status='approved'. A post cannot reach
// LinkedIn unless a human explicitly approved it in the dashboard.

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

const SUPABASE_URL = 'https://mxjlvgzmjmnltfzcwfsh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14amx2Z3ptam1ubHRmemN3ZnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4OTM4MzAsImV4cCI6MjA5MjQ2OTgzMH0.eurPDN8iGug8jYRxKsUgxvjtJ88jRexUMoQb7lgpSAY';
const TABLE = `${SUPABASE_URL}/rest/v1/roi_posts`;
const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};
const VALID_STATUS = ['draft', 'approved', 'posted', 'archived'];

// RFC 4180 quoting — post text is multi-line and full of commas and quotes.
const csvCell = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const csv = req.query.format === 'csv';
    const filter = csv
      ? 'status=eq.approved&order=created_at.asc'          // the publish feed
      : 'status=neq.archived&order=created_at.desc&limit=50';
    const r = await fetch(`${TABLE}?select=*&${filter}`, { headers: HEADERS });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });

    if (!csv) return res.status(200).json({ posts: data });

    // PhantomBuster reads column A by default — "post" is the only column it needs.
    const body = ['post', ...data.map(p => csvCell(p.post_text))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(body);
  }

  if (req.method === 'POST') {
    // Auto Poster webhook: it reports what it published. Match rows back by text
    // and flip them to posted, so they leave the feed.
    // CRITICAL: on days with an empty queue the Auto Poster still pings this
    // webhook with no rows. PhantomBuster removes the webhook URL on any 4xx,
    // so those pings must be acknowledged with 200 — never fall through to the
    // queue-a-post branch (whose validation would answer 400).
    const rows = extractRows(req.body);
    if (isPhantomWebhook(req.body) && !rows.length) {
      return res.status(200).json({ ok: true, marked: 0 });
    }
    if (req.body?.action === 'webhook' || rows.length) {
      const marked = [];
      for (const row of rows) {
        const text = row.post || row.postContent || row.message || row.text;
        const url = row.postUrl || row.url || null;
        if (!text) continue;
        const r = await fetch(
          `${TABLE}?status=eq.approved&post_text=eq.${encodeURIComponent(text)}`,
          {
            method: 'PATCH',
            headers: { ...HEADERS, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ status: 'posted', posted_at: new Date().toISOString(), post_url: url, updated_at: new Date().toISOString() }),
          }
        );
        if (r.ok) marked.push(text.slice(0, 40));
      }
      return res.status(200).json({ ok: true, marked: marked.length });
    }

    // Dashboard: queue a post
    const { post_text, post_type, status } = req.body || {};
    if (!post_text || !String(post_text).trim())
      return res.status(400).json({ error: 'post_text required' });
    if (status && !VALID_STATUS.includes(status))
      return res.status(400).json({ error: 'invalid status' });

    const row = {
      post_text: String(post_text).trim(),
      post_type: post_type || null,
      status: status || 'draft',
      ...(status === 'approved' ? { approved_at: new Date().toISOString() } : {}),
    };
    const r = await fetch(TABLE, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify([row]),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });
    return res.status(200).json({ ok: true, post: Array.isArray(data) ? data[0] : data });
  }

  if (req.method === 'PATCH') {
    const { id, status, post_text } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    if (status && !VALID_STATUS.includes(status))
      return res.status(400).json({ error: 'invalid status' });

    const patch = { updated_at: new Date().toISOString() };
    if (post_text !== undefined) patch.post_text = String(post_text).trim();
    if (status) {
      patch.status = status;
      if (status === 'approved') patch.approved_at = new Date().toISOString();
      if (status === 'posted') patch.posted_at = new Date().toISOString();
    }
    const r = await fetch(`${TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: HEADERS, body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: err });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// PhantomBuster completion payloads carry agent/container metadata even when
// there is no result data. Anything with those markers must never get a 4xx.
function isPhantomWebhook(body) {
  if (!body || typeof body !== 'object') return false;
  return ['agentId', 'agentName', 'containerId', 'exitCode', 'exitMessage', 'resultObject', 'launchDuration']
    .some(k => k in body);
}

// Same tolerant shapes the LinkedIn radar webhook accepts.
function extractRows(body) {
  if (!body) return [];
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.posts)) return body.posts;
  if (body.resultObject) {
    try {
      const parsed = typeof body.resultObject === 'string' ? JSON.parse(body.resultObject) : body.resultObject;
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (_) { return []; }
  }
  return [];
}
