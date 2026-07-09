import { readFileSync } from 'fs';
import { join } from 'path';

// Single source of truth for company-voice generation (proof points, forbidden
// words, audience, image style). Edited by MAS sync — no code redeploy needed.
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5-min cache
  try {
    const data = readFileSync(join(process.cwd(), 'data', 'brand-prompts.json'), 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(data);
  } catch (_) {
    res.status(404).json({ error: 'brand-prompts.json not found' });
  }
}
