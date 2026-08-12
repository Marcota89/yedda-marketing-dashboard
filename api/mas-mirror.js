/* Cloud mirror of the MAS marketing endpoints.

   The MAS runs on Marco's machine at localhost:8000. Everything we built over
   nine rounds — brand voice, worked examples, verticals, forbidden vocabulary —
   therefore reached exactly one laptop. Roi opens the same page and gets the
   offline fallbacks, silently: same URL, different product.

   This closes that gap. `scripts/sync_mas_mirror.py` pushes the MAS assets into
   Supabase; this endpoint serves them to anyone. Revisions travel the other way:
   Roi saves here, the MAS pulls them on the next sync, and no edit is lost while
   Marco's machine is off.

   GET  /api/mas-mirror?key=verticals              → mirrored payload
   GET  /api/mas-mirror?key=examples:linkedin_post
   GET  /api/mas-mirror?revisions=pending          → what the MAS has not consumed
   POST /api/mas-mirror  {pair_id, channel, draft, published, ...}  → store a revision
   POST /api/mas-mirror?action=sync  {key, payload} → upsert a mirrored asset (MAS only)
   POST /api/mas-mirror?action=consume {pair_ids:[]} → mark revisions as pulled (MAS only)
*/

const SUPABASE_URL = 'https://mxjlvgzmjmnltfzcwfsh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14amx2Z3ptam1ubHRmemN3ZnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4OTM4MzAsImV4cCI6MjA5MjQ2OTgzMH0.eurPDN8iGug8jYRxKsUgxvjtJ88jRexUMoQb7lgpSAY';

const MIRROR = `${SUPABASE_URL}/rest/v1/mas_mirror`;
const REVISIONS = `${SUPABASE_URL}/rest/v1/mas_revisions`;

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// Writes that only the MAS may perform (sync, consume) reuse the intake secret.
// Unset = open, matching queue-intake.js: a missing secret must not lock Marco
// out of a mirror that has no secret configured yet.
function masAuthorized(req) {
  const secret = process.env.QUEUE_INTAKE_SECRET;
  if (!secret) return true;
  const sent = req.headers['x-intake-secret'] || (req.query && req.query.secret);
  return sent === secret;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Intake-Secret');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'POST') return await handlePost(req, res);
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message || err) });
  }
}

async function handleGet(req, res) {
  const { key, revisions } = req.query || {};

  if (revisions === 'pending') {
    if (!masAuthorized(req)) return res.status(401).json({ error: 'unauthorized' });
    const r = await fetch(
      `${REVISIONS}?consumed_at=is.null&select=*&order=created_at.asc&limit=500`,
      { headers: HEADERS },
    );
    const rows = await r.json();
    return res.status(200).json({ count: Array.isArray(rows) ? rows.length : 0, revisions: rows });
  }

  if (!key) {
    // No key: report what the mirror holds and how fresh it is. Cheap to call,
    // and the timestamps make a stale mirror visible instead of plausible.
    const r = await fetch(`${MIRROR}?select=key,synced_at&order=key.asc`, { headers: HEADERS });
    const rows = await r.json();
    return res.status(200).json({ keys: rows });
  }

  const r = await fetch(
    `${MIRROR}?key=eq.${encodeURIComponent(key)}&select=payload,synced_at&limit=1`,
    { headers: HEADERS },
  );
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(404).json({ error: 'not mirrored yet', key });
  }
  // 5 minutes: the assets change on a human timescale, and a stale-by-minutes
  // vocabulary is far better than a page that waits on the network.
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  return res.status(200).json({ key, synced_at: rows[0].synced_at, ...rows[0].payload });
}

async function handlePost(req, res) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const action = (req.query && req.query.action) || '';

  if (action === 'sync') {
    if (!masAuthorized(req)) return res.status(401).json({ error: 'unauthorized' });
    if (!body.key || body.payload === undefined) {
      return res.status(400).json({ error: 'key and payload are required' });
    }
    const r = await fetch(`${MIRROR}?on_conflict=key`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: body.key, payload: body.payload, synced_at: new Date().toISOString() }),
    });
    if (!r.ok) return res.status(502).json({ error: 'mirror write failed', detail: await r.text() });
    return res.status(200).json({ ok: true, key: body.key });
  }

  if (action === 'consume') {
    if (!masAuthorized(req)) return res.status(401).json({ error: 'unauthorized' });
    const ids = Array.isArray(body.pair_ids) ? body.pair_ids : [];
    if (!ids.length) return res.status(400).json({ error: 'pair_ids required' });
    const list = ids.map(encodeURIComponent).join(',');
    const r = await fetch(`${REVISIONS}?pair_id=in.(${list})`, {
      method: 'PATCH',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ consumed_at: new Date().toISOString() }),
    });
    if (!r.ok) return res.status(502).json({ error: 'consume failed', detail: await r.text() });
    return res.status(200).json({ ok: true, consumed: ids.length });
  }

  // Default POST: a human saved a revision. Open by design — this is the page
  // itself writing, the same trust level as every other write endpoint here.
  const draft = String(body.draft || '');
  const published = String(body.published || '');
  if (!published.trim()) return res.status(400).json({ error: 'published is required' });

  const row = {
    pair_id: String(body.pair_id || `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    channel: String(body.channel || 'linkedin_post'),
    draft,
    published,
    topic: body.topic ? String(body.topic) : null,
    source: String(body.source || 'platform'),
  };

  const r = await fetch(`${REVISIONS}?on_conflict=pair_id`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  if (!r.ok) return res.status(502).json({ error: 'revision write failed', detail: await r.text() });
  return res.status(200).json({ ok: true, pair_id: row.pair_id });
}
