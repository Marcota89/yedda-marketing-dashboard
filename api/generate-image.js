// Vercel serverless proxy — bypasses browser CORS for Gemini Interactions API
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, apiKey } = req.body || {};
  if (!prompt || !apiKey) return res.status(400).json({ error: 'Missing prompt or apiKey' });

  // Recursively search any object for a base64 image string (>1000 chars, alphanumeric+/=)
  function findBase64(obj, depth = 0) {
    if (depth > 8 || !obj) return null;
    if (typeof obj === 'string' && obj.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(obj.slice(0, 40))) return obj;
    if (Array.isArray(obj)) {
      for (const item of obj) { const r = findBase64(item, depth + 1); if (r) return r; }
    } else if (typeof obj === 'object') {
      for (const key of Object.keys(obj)) { const r = findBase64(obj[key], depth + 1); if (r) return r; }
    }
    return null;
  }

  const models = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image'];

  for (const model of models) {
    try {
      const geminiRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/interactions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
            'Api-Revision': '2026-05-20'
          },
          body: JSON.stringify({
            model,
            input: [{ type: 'text', text: prompt }],
            response_format: {
              type: 'image',
              mime_type: 'image/jpeg',
              aspect_ratio: '4:5',
              image_size: '1K'
            }
          })
        }
      );

      const data = await geminiRes.json();

      if (!geminiRes.ok) {
        // Return full error response for debugging
        return res.status(500).json({
          error: `${model}: HTTP ${geminiRes.status}`,
          detail: data
        });
      }

      // Try known paths first, then recursive search
      const step = (data?.steps || [])[0];
      const b64 = (step?.content || []).find(c => c.data)?.data
               || data?.output_image?.data
               || data?.image?.data
               || data?.result?.image?.data
               || (data?.candidates?.[0]?.content?.parts || []).find(p => p.inlineData?.data)?.inlineData?.data
               || findBase64(data);

      if (b64) return res.status(200).json({ b64, model });

      // Return full response so we can see the actual structure
      return res.status(500).json({
        error: `${model}: 200 OK but no image found`,
        rawKeys: Object.keys(data),
        raw: data  // full response for debugging
      });

    } catch (e) {
      return res.status(500).json({ error: `${model}: ${e.message}` });
    }
  }

  return res.status(500).json({ error: 'All models failed' });
}
