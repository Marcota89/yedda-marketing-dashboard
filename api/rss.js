// Vercel serverless RSS proxy — fetches Google News RSS server-side (no CORS, no rss2json)
// Accepts pipe-separated queries: GET /api/rss?q=query1|query2|query3&count=5

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, s-maxage=300');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, count = '5' } = req.query;
  if (!q) return res.status(400).json({ error: 'q parameter required' });

  const queries = q.split('|').filter(Boolean).slice(0, 8);
  const maxPerQuery = Math.min(parseInt(count) || 5, 10);
  const gnBase = 'https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=';

  const results = await Promise.all(queries.map(async (query) => {
    const url = gnBase + encodeURIComponent(query.trim()) + '&sortBy=date';
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return [];
      const xml = await r.text();
      return parseRssItems(xml, maxPerQuery);
    } catch (_) {
      return [];
    }
  }));

  const seen = new Set();
  const items = results.flat().filter(item => {
    if (!item.title || seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  }).slice(0, 20);

  return res.status(200).json({ items });
}

function parseRssItems(xml, max) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null && items.length < max) {
    const s = m[1];
    const title = extractTag(s, 'title');
    const link  = extractRaw(s, 'link');
    const pub   = extractRaw(s, 'pubDate');
    const desc  = extractTag(s, 'description');
    if (title) items.push({ title, link, pubDate: pub, description: desc });
  }
  return items;
}

// Handles CDATA and strips inner HTML tags
function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return '';
  let v = m[1].trim();
  const cd = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cd) v = cd[1].trim();
  return v.replace(/<[^>]+>/g, '').trim();
}

// Plain text only (URLs, dates — no CDATA needed)
function extractRaw(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}
