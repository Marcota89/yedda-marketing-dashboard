// PhantomBuster config-as-code — applies desired-config.json to every managed agent.
//
// Usage:
//   node scripts/phantombuster/pb-sync.mjs --show               inspect agents (read-only)
//   node scripts/phantombuster/pb-sync.mjs --apply --dry-run    preview changes
//   node scripts/phantombuster/pb-sync.mjs --apply              apply + verify
//
// Env:
//   PHANTOMBUSTER_API_KEY  (required) — workspace API key
//
// Each agent's argument and schedule are two separate /agents/save calls, so an
// unexpected schedule schema never blocks the argument change.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.phantombuster.com/api/v2';
const KEY = process.env.PHANTOMBUSTER_API_KEY;
const CONFIG = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'desired-config.json'), 'utf8'));

// CRITICAL: day/dow/month must be FULLY POPULATED. Empty arrays pass API
// validation but match no date, so the agent silently never launches (that bug
// cost 4 days of missed runs). dow/month are string enums, not numbers.
const ALL_DAYS   = Array.from({ length: 31 }, (_, n) => n + 1);
const ALL_DOW    = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const ALL_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const CRON_FIELDS = ['minute', 'hour', 'day', 'dow', 'month'];

const args = new Set(process.argv.slice(2));
const MODE = args.has('--show') ? 'show' : args.has('--apply') ? 'apply' : null;
const DRY = args.has('--dry-run');

if (!MODE) { console.error('Usage: pb-sync.mjs --show | --apply [--dry-run]'); process.exit(2); }
if (!KEY) { console.error('FATAL: PHANTOMBUSTER_API_KEY env var is not set.'); process.exit(2); }

const die = e => { console.error(`FATAL: ${e.message || e}`); process.exit(1); };
process.on('unhandledRejection', die);
process.on('uncaughtException', die);

// Both header spellings are accepted across PB API versions — send both.
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Phantombuster-Key': KEY,
  'X-Phantombuster-Key-1': KEY,
};

async function pb(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { headers: HEADERS, ...opts });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path} → HTTP ${r.status}: ${typeof body === 'string' ? body.slice(0, 400) : JSON.stringify(body).slice(0, 400)}`);
  return body;
}

const parseArgument = a => a.argument == null ? {} : (typeof a.argument === 'string' ? JSON.parse(a.argument) : a.argument);

const allAgents = await pb('/agents/fetch-all');
const agentList = Array.isArray(allAgents) ? allAgents : (allAgents.agents || []);

function resolve(spec) {
  const needle = spec.agentNameMatch.toLowerCase();
  const hits = agentList.filter(a => (a.name || '').toLowerCase().includes(needle));
  if (!hits.length) {
    console.error(`FATAL: no agent matching "${spec.agentNameMatch}". Agents in workspace:`);
    agentList.forEach(a => console.error(`  - [${a.id}] ${a.name}`));
    process.exit(1);
  }
  if (hits.length > 1) console.warn(`WARN: ${hits.length} agents match "${spec.agentNameMatch}" — using [${hits[0].id}].`);
  return hits[0].id;
}

const specs = CONFIG.agents || [];
if (!specs.length) { console.error('FATAL: desired-config.json has no "agents".'); process.exit(2); }

let failures = 0;

for (const spec of specs) {
  const id = resolve(spec);
  const agent = await pb(`/agents/fetch?id=${encodeURIComponent(id)}`);
  const currentArg = parseArgument(agent);

  console.log(`\n=== ${spec.key} — [${agent.id}] ${agent.name} ===`);
  if (MODE === 'show') {
    console.log(`launchType: ${agent.launchType ?? '(unset)'}`);
    console.log(`repeatedLaunchTimes: ${JSON.stringify(agent.repeatedLaunchTimes ?? null)}`);
    console.log(`argument: ${JSON.stringify(currentArg, null, 2)}`);
    continue;
  }

  // ── 1. Argument ──
  const overrides = spec.argumentOverrides || {};
  const newArg = { ...currentArg, ...overrides };
  const argChanged = JSON.stringify(newArg) !== JSON.stringify(currentArg);
  const changedKeys = Object.keys(overrides).filter(k => JSON.stringify(currentArg[k]) !== JSON.stringify(overrides[k]));
  console.log(`[1/2] argument: ${argChanged ? `set ${changedKeys.join(', ')}` : 'already at desired state'}`);
  if (argChanged && !DRY) {
    await pb('/agents/save', { method: 'POST', body: JSON.stringify({ id: agent.id, argument: newArg }) });
    console.log('      saved.');
  }

  // ── 2. Schedule ──
  const s = spec.schedule || {};
  if (!s.enabled) {
    console.log('[2/2] schedule: disabled in desired-config.json — skipped');
  } else {
    const dow = (s.daysOfWeek && s.daysOfWeek.length) ? s.daysOfWeek : ALL_DOW;
    const desired = {
      minute: [s.minute ?? 0], hour: [s.hour ?? 8],
      day: ALL_DAYS, dow, month: ALL_MONTHS,
      timezone: s.timezone || 'America/Sao_Paulo',
      isSimplePresetEnabled: false,
    };
    const cur = agent.repeatedLaunchTimes || {};
    const sameCron = CRON_FIELDS.every(k => JSON.stringify(cur[k]) === JSON.stringify(desired[k]));
    const already = agent.launchType === 'repeatedly' && sameCron;
    console.log(`[2/2] schedule: ${already ? 'already at desired state' : `set repeatedly ${String(s.hour).padStart(2, '0')}:${String(s.minute ?? 0).padStart(2, '0')} ${desired.timezone} [${dow.join(',')}]`}`);
    if (!already && !DRY) {
      try {
        await pb('/agents/save', { method: 'POST', body: JSON.stringify({ id: agent.id, launchType: 'repeatedly', repeatedLaunchTimes: desired }) });
        console.log('      saved.');
      } catch (e) {
        console.error(`      SCHEDULE FAILED (argument update was NOT rolled back): ${e.message}`);
        failures++;
        continue;
      }
    }
  }

  if (DRY) continue;

  // ── Verify: prove the cron can actually MATCH a date. Checking only
  //    launchType==='repeatedly' is what let the empty-array bug ship silently.
  const after = await pb(`/agents/fetch?id=${encodeURIComponent(agent.id)}`);
  const afterArg = parseArgument(after);
  const rlt = after.repeatedLaunchTimes || {};
  const cronFires = CRON_FIELDS.every(k => Array.isArray(rlt[k]) && rlt[k].length > 0);
  const okArg = Object.entries(overrides).every(([k, v]) => JSON.stringify(afterArg[k]) === JSON.stringify(v));
  const okSched = !s.enabled || (after.launchType === 'repeatedly' && cronFires);

  if (s.enabled && after.launchType === 'repeatedly' && !cronFires) {
    console.error(`      SCHEDULE WILL NEVER FIRE — empty cron field(s): ${CRON_FIELDS.filter(k => !(rlt[k] || []).length).join(', ')}`);
  }
  console.log(`VERIFY: ${Object.keys(overrides).map(k => `${k}=${JSON.stringify(afterArg[k])}`).join(' ')} launchType=${after.launchType} cronFires=${cronFires}`);
  if (!okArg || !okSched) { console.error('VERIFY FAILED'); failures++; }
}

if (DRY) { console.log('\nDRY RUN — nothing written.'); process.exit(0); }
if (MODE === 'show') process.exit(0);
console.log(failures ? `\n${failures} AGENT(S) FAILED` : '\nSYNC OK');
process.exit(failures ? 1 : 0);
