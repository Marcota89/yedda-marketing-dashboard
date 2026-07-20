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
const TABLE_TIERS = `${SUPABASE_URL}/rest/v1/contact_tiers`;

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

const VALID_STATUS = ['none', 'pending_approval', 'approved', 'rejected', 'posted'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    // Paid-plan volume: 70 contacts × 5 posts/day — default 300, cap 500.
    // Optional filters: ?days=N (published_at window), ?tier=1-priority
    const limit = Math.min(parseInt(req.query.limit) || 300, 500);
    let url = `${TABLE}?select=*&order=published_at.desc.nullslast&limit=${limit}`;
    const days = parseInt(req.query.days);
    if (days > 0) {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      url += `&published_at=gte.${encodeURIComponent(since)}`;
    }
    if (req.query.tier) url += `&tier=eq.${encodeURIComponent(req.query.tier)}`;
    const r = await fetch(url, { headers: HEADERS });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });
    return res.status(200).json({ posts: data });
  }

  if (req.method === 'POST') {
    // Handoff to Hermes prospecting queue — deliberate, human-triggered from the
    // dashboard. status=pending so Hermes review gates any actual outreach.
    if (req.body && req.body.action === 'handoff') return handleHandoff(req, res);

    // Approval-policy workflow (People's Posts). No auth gate by design — posting
    // stays manual, so the real gate is who holds Roi's LinkedIn login. A PIN
    // becomes a prerequisite only when auto-posting is introduced later.
    if (req.body && req.body.action === 'set-policy') return handleSetPolicy(req, res);
    if (req.body && req.body.action === 'approve')    return handleApprove(req, res);
    if (req.body && req.body.action === 'reject')     return handleReject(req, res);

    // If PB_WEBHOOK_SECRET is set in Vercel env, require it (?secret=... on the webhook URL).
    const secret = process.env.PB_WEBHOOK_SECRET;
    if (secret && req.query.secret !== secret)
      return res.status(401).json({ error: 'invalid webhook secret' });

    const rows = extractRows(req.body).map(normalize).filter(r => r.post_url);
    if (!rows.length) {
      // PhantomBuster removes the webhook URL on any 4xx — an empty or failed
      // run must be acknowledged with 200, never rejected.
      if (isPhantomWebhook(req.body)) return res.status(200).json({ ok: true, count: 0 });
      return res.status(400).json({ error: 'no rows with a post URL found in payload' });
    }

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
    const { post_url, roi_comment, commented, comment_status, contact_name, contact_company } = req.body || {};
    if (!post_url) return res.status(400).json({ error: 'post_url required' });

    const patch = { updated_at: new Date().toISOString() };
    if (roi_comment !== undefined) patch.roi_comment = roi_comment;
    if (commented !== undefined) patch.commented = !!commented;
    if (comment_status !== undefined) {
      if (!VALID_STATUS.includes(comment_status))
        return res.status(400).json({ error: 'invalid comment_status' });
      patch.comment_status = comment_status;
      if (comment_status === 'posted') patch.posted_at = new Date().toISOString();
    }
    // Marking a post as commented is the terminal "posted" state — keep the
    // legacy `commented` flag (warm-lead signal reads it) and the new status aligned.
    if (commented === true) { patch.comment_status = 'posted'; patch.posted_at = new Date().toISOString(); }

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

// ── Approval-policy workflow ──────────────────────────────────────────────

// Toggle a contact's approval policy. Writes the durable value to contact_tiers
// (so future scraped posts inherit it via the trigger) AND to every existing
// post from that contact (denormalized, like `tier`), so all their cards update.
async function handleSetPolicy(req, res) {
  const b = req.body || {};
  const policy = b.approval_policy;
  if (policy !== 'review' && policy !== 'auto')
    return res.status(400).json({ error: "approval_policy must be 'review' or 'auto'" });

  const url  = (b.contact_profile_url || b.profile_url || '').trim();
  const name = (b.contact_name || '').trim();
  if (!url && !name)
    return res.status(400).json({ error: 'contact_profile_url or contact_name required' });

  // 1. Durable source of truth — upsert on the contact sheet (PK profile_url).
  if (url) {
    await fetch(`${TABLE_TIERS}?on_conflict=profile_url`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ profile_url: url, approval_policy: policy, ...(name ? { contact_name: name } : {}) }]),
    }).catch(() => {});
  }

  // 2. Denormalized copy — every existing post from this contact.
  const filter = url
    ? `contact_profile_url=eq.${encodeURIComponent(url)}`
    : `contact_name=eq.${encodeURIComponent(name)}`;
  const r = await fetch(`${TABLE}?${filter}`, {
    method: 'PATCH',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ approval_policy: policy, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    return res.status(r.status).json({ error: err });
  }
  return res.status(200).json({ ok: true, approval_policy: policy });
}

// Approve a pending comment (optionally with Roi's edited text). Ready to post.
async function handleApprove(req, res) {
  const { post_url, roi_comment } = req.body || {};
  if (!post_url) return res.status(400).json({ error: 'post_url required' });
  const patch = {
    comment_status: 'approved',
    approved_at: new Date().toISOString(),
    rejection_note: null,
    updated_at: new Date().toISOString(),
  };
  if (roi_comment !== undefined) patch.roi_comment = roi_comment;
  const r = await fetch(`${TABLE}?post_url=eq.${encodeURIComponent(post_url)}`, {
    method: 'PATCH', headers: HEADERS, body: JSON.stringify(patch),
  });
  if (!r.ok) { const err = await r.json().catch(() => ({})); return res.status(r.status).json({ error: err }); }
  return res.status(200).json({ ok: true });
}

// Reject a pending comment with a short reason (kept for the regenerate cycle).
async function handleReject(req, res) {
  const { post_url, rejection_note } = req.body || {};
  if (!post_url) return res.status(400).json({ error: 'post_url required' });
  const patch = {
    comment_status: 'rejected',
    rejection_note: (rejection_note || '').slice(0, 500) || null,
    updated_at: new Date().toISOString(),
  };
  const r = await fetch(`${TABLE}?post_url=eq.${encodeURIComponent(post_url)}`, {
    method: 'PATCH', headers: HEADERS, body: JSON.stringify(patch),
  });
  if (!r.ok) { const err = await r.json().catch(() => ({})); return res.status(r.status).json({ error: err }); }
  return res.status(200).json({ ok: true });
}

// PhantomBuster completion payloads carry agent/container metadata even when
// there is no result data. Anything with those markers must never get a 4xx.
function isPhantomWebhook(body) {
  if (!body || typeof body !== 'object') return false;
  return ['agentId', 'agentName', 'containerId', 'exitCode', 'exitMessage', 'resultObject', 'launchDuration']
    .some(k => k in body);
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

  // On a repost, PhantomBuster's `author` is the ORIGINAL author — NOT our
  // contact. Keep it in post_author; the DB trigger restores the real contact
  // identity (name/title/company) from the CRM using contact_profile_url, which
  // always points at the profile we actually scraped.
  const sharedPostUrl = pick('sharedPostUrl', 'shared_post_url');
  const action = String(pick('action') || '');
  const isRepost = !!sharedPostUrl || /shared|compartilh|repost/i.test(action);

  return {
    post_url:            postUrl,
    post_author:         pick('author', 'fullName', 'name', 'profileName'),
    contact_name:        pick('fullName', 'contact_name', 'name', 'profileName', 'author'),
    contact_title:       pick('title', 'headline', 'contact_title', 'occupation', 'job'),
    contact_company:     pick('company', 'companyName', 'contact_company'),
    contact_profile_url: pick('profileUrl', 'profileLink', 'contact_profile_url', 'baseUrl'),
    contact_photo_url:   pick('profileImageUrl', 'imgUrl', 'profilePicture', 'contact_photo_url'),
    post_text:           pick('postContent', 'post_text', 'textContent', 'text', 'content', 'description'),
    published_at:        publishedAt,
    likes_count:         parseInt(pick('likeCount', 'likesCount', 'likes')) || 0,
    comments_count:      parseInt(pick('commentCount', 'commentsCount', 'comments')) || 0,
    shared_post_url:     sharedPostUrl,
    is_repost:           isRepost,
    source:              r._manual ? 'manual' : 'phantombuster',
    updated_at:          new Date().toISOString(),
  };
}
