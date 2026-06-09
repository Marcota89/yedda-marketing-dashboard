// Vercel serverless proxy — bypasses browser CORS for Gemini Interactions API
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, apiKey } = req.body || {};
  if (!prompt || !apiKey) return res.status(400).json({ error: 'Missing prompt or apiKey' });

  const models = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image'];
  const errors = [];

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
        errors.push(`${model}: HTTP ${geminiRes.status} — ${data?.error?.message || JSON.stringify(data).slice(0, 120)}`);
        continue;
      }

      // Try multiple response paths
      const step = (data?.steps || [])[0];
      const b64 = (step?.content || []).find(c => c.data)?.data
               || data?.output_image?.data
               || data?.image?.data
               || (data?.candidates?.[0]?.content?.parts || []).find(p => p.inlineData?.data)?.inlineData?.data;

      if (b64) return res.status(200).json({ b64, model, raw: null });

      errors.push(`${model}: response OK but no image — ${JSON.stringify(data).slice(0, 300)}`);
    } catch (e) {
      errors.push(`${model}: ${e.message}`);
    }
  }

  return res.status(500).json({ error: errors.join(' | ') });
}
