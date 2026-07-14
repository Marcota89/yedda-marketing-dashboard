// Vercel serverless — warm leads from LinkedIn engagement.
//
// Feeds the PhantomBuster "LinkedIn Post Likers Export" / "Post Commenters Export"
// with the posts ROI TOOK PART IN, and receives the people who engaged with them.
//
// GET  /api/engagers?format=csv  → CSV of post URLs for the Phantom to scrape
//                                  (Roi's published posts + posts he commented on)
// GET  /api/engagers             → JSON list of engagers (dashboard)
// POST /api/engagers             → webhook from PhantomBuster (the engagers)
// PATCH /api/engagers            → { profile_url, handoff_sent }
//
// Why these posts: someone who liked or commented where Roi already participated
// has plausibly seen him. That is a genuinely warm signal — far better than a cold
// search export — and it keeps the scrape small enough for the 20h/month cap.

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const SUPABASE_URL = 'https://mxjlvgzmjmnltfzcwfsh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14amx2Z3ptam1ubHRmemN3ZnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4OTM4MzAsImV4cCI6MjA5MjQ2OTgzMH0.eurPDN8iGug8jYRxKsUgxvjtJ88jRexUMoQb7lgpSAY';
const REST = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

const csvCell = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET' && req.query.format === 'csv') {
    // The scrape targets: Roi's own published posts + posts he commented on.
    const [mine, engaged] = await Promise.all([
      fetch(`${REST}/roi_posts?select=post_url&status=eq.posted&post_url=not.is.null`, { headers: HEADERS }).then(r => r.json()).catch(() => []),
      fetch(`${REST}/linkedin_contacts_posts?select=post_url&commented=eq.true&post_url=not.is.null&order=updated_at.desc&limit=40`, { headers: HEADERS }).then(r => r.json()).catch(() => []),
    ]);
    const urls = [...new Set([
      ...(Array.isArray(mine) ? mine : []).map(p => p.post_url),
      ...(Array.isArray(engaged) ? engaged : []).map(p => p.post_url),
    ].filter(Boolean))];

    const body = ['postUrl', ...urls.map(csvCell)].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(body);
  }

  if (req.method === 'GET') {
    // New leads first: unknown people, most engaged, not yet handed to Hermes.
    const r = await fetch(
      `${REST}/linkedin_engagers?select=*&order=times_seen.desc,first_seen_at.desc&limit=200`,
      { headers: HEADERS }
    );
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });
    return res.status(200).json({ engagers: data });
  }

  if (req.method === 'POST') {
    const rows = extractRows(req.body).map(normalize).filter(e => e.profile_url);
    if (!rows.length) return res.status(400).json({ error: 'no rows with a profile URL found' });

    // Dedupe within the payload — the same person can like several posts.
    const byUrl = new Map();
    for (const e of rows) {
      const prev = byUrl.get(e.profile_url);
      byUrl.set(e.profile_url, prev ? { ...prev, ...e, times_seen: (prev.times_seen || 1) + 1 } : e);
    }
    const unique = [...byUrl.values()];

    // merge-duplicates preserves handoff_sent (absent from this payload).
    const r = await fetch(`${REST}/linkedin_engagers?on_conflict=profile_url`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(unique),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: err });
    }
    return res.status(200).json({ ok: true, count: unique.length });
  }

  if (req.method === 'PATCH') {
    const { profile_url, handoff_sent } = req.body || {};
    if (!profile_url) return res.status(400).json({ error: 'profile_url required' });
    const r = await fetch(`${REST}/linkedin_engagers?profile_url=eq.${encodeURIComponent(profile_url)}`, {
      method: 'PATCH', headers: HEADERS,
      body: JSON.stringify({ handoff_sent: !!handoff_sent, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: err });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function extractRows(body) {
  if (!body) return [];
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.engagers)) return body.engagers;
  if (Array.isArray(body.posts)) return body.posts;
  if (body.resultObject) {
    try {
      const parsed = typeof body.resultObject === 'string' ? JSON.parse(body.resultObject) : body.resultObject;
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (_) { return []; }
  }
  return [];
}

// Field names differ between the Likers Export and the Commenters Export.
function normalize(r) {
  const pick = (...keys) => {
    for (const k of keys) if (r[k] !== undefined && r[k] !== null && r[k] !== '') return r[k];
    return null;
  };
  return {
    profile_url:     pick('profileUrl', 'profileLink', 'authorUrl', 'profile_url'),
    full_name:       pick('fullName', 'name', 'author', 'full_name'),
    headline:        pick('headline', 'job', 'title', 'occupation'),
    company:         pick('company', 'companyName'),
    engagement_type: pick('action', 'reactionType', 'engagement_type') ? 'like' : (r.commentContent || r.comment ? 'comment' : 'like'),
    source_post_url: pick('postUrl', 'query', 'source_post_url', 'post_url'),
    times_seen:      1,
    updated_at:      new Date().toISOString(),
  };
}
