// Vercel serverless — LinkedIn contact post monitoring (PhantomBuster → Supabase → dashboard)
// GET    → list monitored posts (newest first)
// POST   → webhook from PhantomBuster (LinkedIn Activity Extractor) OR manual add from dashboard
// PATCH  → save roi_comment / mark commented on a post

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const SUPABASE_URL = 'https://mxjlvgzmjmnltfzcwfsh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14amx2Z3ptam1ubHRmemN3ZnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4OTM4MzAsImV4cCI6MjA5MjQ2OTgzMH0.eurPDN8iGug8jYRxKsUgxvjtJ88jRexUMoQb7lgpSAY';
const TABLE = `${SUPABASE_URL}/rest/v1/linkedin_contacts_posts`;

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const r = await fetch(
      `${TABLE}?select=*&order=published_at.desc.nullslast&limit=100`,
      { headers: HEADERS }
    );
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });
    return res.status(200).json({ posts: data });
  }

  if (req.method === 'POST') {
    // Handoff to Hermes prospecting queue — deliberate, human-triggered from the
    // dashboard. status=pending so Hermes review gates any actual outreach.
    if (req.body && req.body.action === 'handoff') return handleHandoff(req, res);

    // If PB_WEBHOOK_SECRET is set in Vercel env, require it (?secret=... on the webhook URL).
    const secret = process.env.PB_WEBHOOK_SECRET;
    if (secret && req.query.secret !== secret)
      return res.status(401).json({ error: 'invalid webhook secret' });

    const rows = extractRows(req.body).map(normalize).filter(r => r.post_url);
    if (!rows.length)
      return res.status(400).json({ error: 'no rows with a post URL found in payload' });

    // on_conflict=post_url: re-scrapes update engagement counts but never touch
    // roi_comment / commented (those columns are absent from this payload)
    const r = await fetch(`${TABLE}?on_conflict=post_url`, {
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

  if (req.method === 'PATCH') {
    const { post_url, roi_comment, commented, contact_name, contact_company } = req.body || {};
    if (!post_url) return res.status(400).json({ error: 'post_url required' });

    const patch = { updated_at: new Date().toISOString() };
    if (roi_comment !== undefined) patch.roi_comment = roi_comment;
    if (commented !== undefined) patch.commented = !!commented;

    const r = await fetch(`${TABLE}?post_url=eq.${encodeURIComponent(post_url)}`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: err });
    }

    // Marketing → Sales ledger: log the engagement so MAS analytics and the
    // warm-lead signal can see it. Best-effort — never blocks the PATCH response.
    if (commented === true) {
      await logInteraction({
        name: contact_name, company: contact_company, post_url,
        action: 'linkedin_comment',
      }).catch(() => {});
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Append an engagement row to lead_interactions (MAS's ledger). The table is
// keyed by email; LinkedIn contacts rarely have one, so we use the profile/post
// URL as a stable identifier — it never collides with a real email lead.
async function logInteraction({ name, company, post_url, action }) {
  const row = {
    email: post_url || `linkedin:${name || 'unknown'}`,
    company: company || 'Unknown',
    action: action || 'linkedin_comment',
    ts: new Date().toISOString(),
    sdr: 'Roi (Marketing)',
  };
  await fetch(`${SUPABASE_URL}/rest/v1/lead_interactions`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify(row),
  });
}

// Enqueue a warm LinkedIn contact into Hermes's prospecting queue.
async function handleHandoff(req, res) {
  const b = req.body || {};
  const name = (b.prospect_name || b.contact_name || '').trim();
  if (!name) return res.status(400).json({ error: 'prospect_name required' });

  const taskId = 'mkt-' + (globalThis.crypto?.randomUUID?.() || (Date.now() + '-' + Math.round(Math.random() * 1e6)));
  const row = {
    task_id: taskId,
    prospect_name: name,
    company: (b.company || 'Unknown').trim() || 'Unknown',
    region: (b.region || 'Unknown').trim() || 'Unknown',
    title: b.title || null,
    sector: b.sector || null,
    signal_type: 'linkedin_engagement',
    problem_text: b.problem_text || `Warm LinkedIn contact — Roi engaged with their recent post(s). ${b.note || ''}`.trim(),
    status: 'pending',
    enqueued_at: new Date().toISOString(),
  };

  const r = await fetch(`${SUPABASE_URL}/rest/v1/hermes_mas_handoff`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    return res.status(r.status).json({ error: err });
  }

  // Mark every post from this contact as handed off, so the badge clears
  if (b.contact_profile_url || b.contact_name) {
    const filter = b.contact_profile_url
      ? `contact_profile_url=eq.${encodeURIComponent(b.contact_profile_url)}`
      : `contact_name=eq.${encodeURIComponent(b.contact_name)}`;
    await fetch(`${TABLE}?${filter}`, {
      method: 'PATCH', headers: HEADERS,
      body: JSON.stringify({ handoff_sent: true, updated_at: new Date().toISOString() }),
    }).catch(() => {});
  }
  return res.status(200).json({ ok: true, task_id: taskId });
}

// Accepts the three payload shapes that reach this endpoint:
//  1. PhantomBuster webhook: { resultObject: "<json string of rows>", ... }
//  2. Dashboard manual add:  { posts: [...] }
//  3. Raw array of rows:     [...]
function extractRows(body) {
  if (!body) return [];
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.posts)) return body.posts;
  if (body.resultObject) {
    try {
      const parsed = typeof body.resultObject === 'string'
        ? JSON.parse(body.resultObject)
        : body.resultObject;
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (_) { return []; }
  }
  return [];
}

// PhantomBuster field names vary by Phantom version — map every known alias
function normalize(r) {
  const pick = (...keys) => {
    for (const k of keys) {
      if (r[k] !== undefined && r[k] !== null && r[k] !== '') return r[k];
    }
    return null;
  };

  // Try every date field until one parses — PhantomBuster sends both a relative
  // date ("3w") and an ISO timestamp; the relative one must not short-circuit
  let publishedAt = null;
  for (const k of ['postTimestamp', 'timestamp', 'publishedAt', 'published_at', 'postDate', 'date']) {
    if (r[k] === undefined || r[k] === null || r[k] === '') continue;
    const d = new Date(r[k]);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000) { publishedAt = d.toISOString(); break; }
  }

  const postUrl = pick('postUrl', 'post_url', 'url', 'postLink', 'link');

  // Fallback: LinkedIn activity IDs are snowflake-like — ms timestamp = id >> 22
  if (!publishedAt && postUrl) {
    const m = String(postUrl).match(/activity[:-](\d{15,20})/);
    if (m) {
      const ms = Number(BigInt(m[1]) >> 22n);
      const d = new Date(ms);
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000) publishedAt = d.toISOString();
    }
  }

  return {
    post_url:            postUrl,
    contact_name:        pick('fullName', 'contact_name', 'name', 'profileName', 'author'),
    contact_title:       pick('title', 'headline', 'contact_title', 'occupation', 'job'),
    contact_company:     pick('company', 'companyName', 'contact_company'),
    contact_profile_url: pick('profileUrl', 'profileLink', 'contact_profile_url', 'baseUrl'),
    contact_photo_url:   pick('profileImageUrl', 'imgUrl', 'profilePicture', 'contact_photo_url'),
    post_text:           pick('postContent', 'post_text', 'textContent', 'text', 'content', 'description'),
    published_at:        publishedAt,
    likes_count:         parseInt(pick('likeCount', 'likesCount', 'likes')) || 0,
    comments_count:      parseInt(pick('commentCount', 'commentsCount', 'comments')) || 0,
    source:              r._manual ? 'manual' : 'phantombuster',
    updated_at:          new Date().toISOString(),
  };
}
