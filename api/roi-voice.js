import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5-min cache
  try {
    const data = readFileSync(join(process.cwd(), 'data', 'roi-voice.json'), 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(data);
  } catch (_) {
    res.status(404).json({ error: 'roi-voice.json not found' });
  }
}
