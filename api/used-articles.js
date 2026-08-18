/* Global "already used" memory for news articles.

   The page kept this list in localStorage, per browser. Marco and Roi each had
   their own, and each forgot on cache clear — so the same story became a post
   up to five times. This endpoint is the one list both machines consult.

   GET  /api/used-articles?days=45          → { urls: [...], hashes: [...], count }
   GET  /api/used-articles?check=<url>      → { used: bool, by, at }
   POST /api/used-articles  { articles: [{url, title, used_by, post_ref}] } → { ok, stored }

   Matching is by normalized URL *and* by title hash, because the same story is
   republished by several outlets under different URLs (the "Everseen acquires
   Viztel" case: 4 posts, 4 URLs, one story). */

import { createHash } from 'crypto';

const SUPABASE_URL = 'https://mxjlvgzmjmnltfzcwfsh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14amx2Z3ptam1ubHRmemN3ZnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4OTM4MzAsImV4cCI6MjA5MjQ2OTgzMH0.eurPDN8iGug8jYRxKsUgxvjtJ88jRexUMoQb7lgpSAY';
const TABLE = `${SUPABASE_URL}/rest/v1/used_articles`;
const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

export function normalizeUrl(u) {
  try {
    const x = new URL(String(u || '').trim());
    let host = x.hostname.toLowerCase().replace(/^www\./, '');
    let path = x.pathname.replace(/\/+$/, '').toLowerCase();
    // Google News wraps articles: keep the wrapper id stable but drop tracking.
    return host + path;
  } catch (_) {
    return String(u || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  }
}

export function titleHash(t) {
  const norm = String(t || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')   // strip punctuation
    .replace(/\b(the|a|an|of|in|on|for|to|and|with|at|by|from|its|is|are)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return createHash('sha1').update(norm).digest('hex').slice(0, 20);
}

function domainOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { check, days = '45' } = req.query || {};
      if (check) {
        const un = normalizeUrl(check);
        const r = await fetch(`${TABLE}?url_norm=eq.${encodeURIComponent(un)}&select=used_by,first_used_at&limit=1`, { headers: HEADERS });
        const rows = await r.json();
        const hit = Array.isArray(rows) && rows[0];
        return res.status(200).json({ used: !!hit, by: hit ? hit.used_by : null, at: hit ? hit.first_used_at : null });
      }
      const d = Math.min(Math.max(parseInt(days) || 45, 1), 365);
      const since = new Date(Date.now() - d * 864e5).toISOString();
      const r = await fetch(`${TABLE}?first_used_at=gte.${since}&select=url_norm,title_hash&order=first_used_at.desc&limit=2000`, { headers: HEADERS });
      const rows = await r.json();
      const list = Array.isArray(rows) ? rows : [];
      // Short cache: a just-generated post must block re-use within minutes,
      // and the page also merges its local list, so staleness here is safe.
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).json({
        count: list.length,
        urls: list.map(x => x.url_norm),
        hashes: list.map(x => x.title_hash),
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const arts = Array.isArray(body.articles) ? body.articles : [];
      const rows = arts
        .filter(a => a && (a.url || a.title))
        .slice(0, 100)
        .map(a => ({
          // No URL (title-only backfill) → key on the title hash so rows don't
          // collapse into one empty-key record under on_conflict.
          url_norm: a.url ? normalizeUrl(a.url) : ('title:' + titleHash(a.title)),
          title_hash: titleHash(a.title || a.url),
          title: a.title ? String(a.title).slice(0, 300) : null,
          domain: domainOf(a.url || ''),
          used_by: String(a.used_by || body.used_by || 'platform').slice(0, 40),
          post_ref: a.post_ref ? String(a.post_ref).slice(0, 120) : null,
        }));
      if (!rows.length) return res.status(400).json({ error: 'articles[] required' });
      const r = await fetch(`${TABLE}?on_conflict=url_norm`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
      if (!r.ok) return res.status(502).json({ error: 'write failed', detail: await r.text() });
      return res.status(200).json({ ok: true, stored: rows.length });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message || err) });
  }
}
