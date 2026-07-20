// Vercel serverless — serves the PLATFORM Gemini key so every user of the
// dashboard shares one key without pasting their own.
//
// GET /api/gemini-key  →  { key: "<GEMINI_API_KEY>" } | { key: null }
//
// The key lives in the Vercel env var GEMINI_API_KEY (Project → Settings →
// Environment Variables). Update it there once and every browser reflects it —
// no per-user Settings step. A user CAN still paste their own key in Settings;
// that local key takes precedence over this platform key (see _getGeminiKey in
// index.html).
//
// NOTE ON EXPOSURE: this returns the key to the browser, exactly as the current
// design already does (the key sits in localStorage and is sent straight to
// generativelanguage.googleapis.com from the client). This endpoint changes
// WHERE the shared key is stored (server env, one place to rotate) — not its
// exposure model. Lock the key down with an HTTP-referrer restriction in Google
// AI Studio so it only works from the dashboard's domain.

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  // Let browsers cache briefly so this isn't fetched on every generate call.
  res.setHeader('Cache-Control', 'public, max-age=300');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.GEMINI_API_KEY || null;
  return res.status(200).json({ key });
}
