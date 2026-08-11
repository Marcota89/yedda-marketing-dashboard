// Vercel serverless — intake for posts produced OUTSIDE the dashboard.
//
// The F31 (MAS) generates the weekly batch and, until now, wrote it to a file
// nobody opened. This is the door into the same approval queue Roi already
// works: the post lands in `marketing_posts`, appears in the dashboard on the
// next sync, and goes through the same review, brand gate and revision capture
// as anything generated here. One reviewed pipeline, several producers.
//
// POST /api/queue-intake
//   { source: "f31", posts: [ { body, hook?, pillar?, persona?, sector?,
//                               image_prompt?, topic?, external_id? } ] }
//   → { ok, accepted, rejected: [{ index, reason }], post_ids }
//
// Auth: optional shared secret. Set QUEUE_INTAKE_SECRET in Vercel and send it
// as `X-Intake-Secret` (or ?secret=). Unset = open, which is the current
// posture of every other endpoint here and keeps local MAS runs frictionless.

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const SUPABASE_URL = 'https://mxjlvgzmjmnltfzcwfsh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14amx2Z3ptam1ubHRmemN3ZnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4OTM4MzAsImV4cCI6MjA5MjQ2OTgzMH0.eurPDN8iGug8jYRxKsUgxvjtJ88jRexUMoQb7lgpSAY';
const TABLE = `${SUPABASE_URL}/rest/v1/marketing_posts`;
const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

const MIN_BODY = 80;   // shorter than this is not a LinkedIn post
const MAX_BATCH = 20;  // a weekly batch is 2-5; 20 is a runaway guard

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Intake-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.QUEUE_INTAKE_SECRET;
  if (secret) {
    const sent = req.headers['x-intake-secret'] || req.query.secret;
    if (sent !== secret) return res.status(401).json({ error: 'invalid intake secret' });
  }

  const body = req.body || {};
  const source = String(body.source || 'external').slice(0, 40);
  const incoming = Array.isArray(body.posts) ? body.posts : [];

  if (!incoming.length) return res.status(400).json({ error: 'posts[] is required and must be non-empty' });
  if (incoming.length > MAX_BATCH)
    return res.status(400).json({ error: `batch too large: ${incoming.length} posts (max ${MAX_BATCH})` });

  // Validate first, insert second: a batch that is half-rejected should say so
  // per item rather than half-writing and reporting success.
  const rejected = [];
  const rows = [];
  const now = new Date();

  incoming.forEach((p, index) => {
    const text = typeof p?.body === 'string' ? p.body.trim() : '';
    if (text.length < MIN_BODY) {
      rejected.push({ index, reason: `body shorter than ${MIN_BODY} chars` });
      return;
    }
    const postId = String(p.external_id || `${source}-${now.toISOString().slice(0, 10)}-${index}`);
    rows.push({
      post_id: postId,
      post_data: {
        _id: postId,
        name: 'Yedda.ai',
        headline: 'Intelligence Augmentation · AI + IA for Enterprise Operations',
        time: `${MONTHS[now.getMonth()]} ${now.getDate()} · 🌐`,
        body: text,
        src: p.topic ? `${source} · ${String(p.topic).slice(0, 80)}` : `${source} · weekly batch`,
        tags: p.tags || '#YeddaAI #VisualAI',
        prompt: p.image_prompt || '',
        meta: {
          char: p.persona || 'Abbey',
          time: '9–10AM',
          target: 'Operations Leaders',
          day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()],
        },
        _hookPreview: (p.hook || text).slice(0, 80),
        _pillar: p.pillar || 'Educational',
        _sector: p.sector || null,
        _source: source,          // shows provenance in the queue
        _dateDay: String(now.getDate()).padStart(2, '0'),
        _dateMonth: MONTHS[now.getMonth()],
      },
    });
  });

  if (!rows.length)
    return res.status(400).json({ error: 'no valid posts in batch', rejected });

  // merge-duplicates so a re-run of the same batch updates instead of doubling.
  const r = await fetch(`${TABLE}?on_conflict=post_id`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    return res.status(r.status).json({ error: err });
  }

  return res.status(200).json({
    ok: true,
    accepted: rows.length,
    rejected,
    post_ids: rows.map(row => row.post_id),
    note: 'Posts are in the review queue — they are not published until a human approves them.',
  });
}
