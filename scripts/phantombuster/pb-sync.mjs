// PhantomBuster config-as-code — applies desired-config.json to the Activity Extractor
//
// Usage:
//   node scripts/phantombuster/pb-sync.mjs --show               inspect agent (read-only)
//   node scripts/phantombuster/pb-sync.mjs --apply --dry-run    preview changes
//   node scripts/phantombuster/pb-sync.mjs --apply              apply + verify
//
// Env:
//   PHANTOMBUSTER_API_KEY  (required) — workspace API key
//   PB_AGENT_ID            (optional) — skip name-based discovery
//
// The argument update and the schedule update are two separate /agents/save
// calls, so an unexpected repeatedLaunchTimes schema never blocks the
// profiles-per-launch change.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.phantombuster.com/api/v2';
const KEY = process.env.PHANTOMBUSTER_API_KEY;
const CONFIG = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'desired-config.json'), 'utf8'));

// Keys PhantomBuster has used across Phantom versions for "profiles per launch"
const PROFILE_KEY_ALIASES = [
  'numberOfProfilesPerLaunch', 'numberOfLinesPerLaunch', 'numberOfProfiles',
  'profilesPerLaunch', 'numberOfProfilesToProcess', 'spreadsheetUrlExclusionListNumberOfLinesPerLaunch',
];

const args = new Set(process.argv.slice(2));
const MODE = args.has('--show') ? 'show' : args.has('--apply') ? 'apply' : null;
const DRY = args.has('--dry-run');

if (!MODE) { console.error('Usage: pb-sync.mjs --show | --apply [--dry-run]'); process.exit(2); }
if (!KEY) { console.error('FATAL: PHANTOMBUSTER_API_KEY env var is not set.'); process.exit(2); }

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
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path} → HTTP ${r.status}: ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
  return body;
}

function parseArgument(agent) {
  if (agent.argument == null) return {};
  return typeof agent.argument === 'string' ? JSON.parse(agent.argument) : agent.argument;
}

async function findAgent() {
  if (process.env.PB_AGENT_ID) return pb(`/agents/fetch?id=${encodeURIComponent(process.env.PB_AGENT_ID)}`);
  const all = await pb('/agents/fetch-all');
  const list = Array.isArray(all) ? all : all.agents || [];
  const needle = CONFIG.agentNameMatch.toLowerCase();
  const hits = list.filter(a => (a.name || '').toLowerCase().includes(needle) || (a.scriptName || '').toLowerCase().includes(needle));
  if (!hits.length) {
    console.error(`FATAL: no agent matching "${CONFIG.agentNameMatch}". Agents in workspace:`);
    list.forEach(a => console.error(`  - [${a.id}] ${a.name}`));
    process.exit(1);
  }
  if (hits.length > 1) console.warn(`WARN: ${hits.length} agents match — using the first. Pin PB_AGENT_ID to disambiguate.`);
  return pb(`/agents/fetch?id=${encodeURIComponent(hits[0].id)}`);
}

function summarize(agent) {
  const arg = parseArgument(agent);
  console.log(`\nAgent: [${agent.id}] ${agent.name}`);
  console.log(`launchType: ${agent.launchType ?? '(unset)'}`);
  console.log(`repeatedLaunchTimes: ${JSON.stringify(agent.repeatedLaunchTimes ?? null)}`);
  console.log('argument:');
  console.log(JSON.stringify(arg, null, 2));
  return arg;
}

const die = e => { console.error(`FATAL: ${e.message || e}`); process.exit(1); };
process.on('unhandledRejection', die);
process.on('uncaughtException', die);

const agent = await findAgent();
const currentArg = summarize(agent);

if (MODE === 'show') process.exit(0);

// ── 1. Argument update: profiles per launch (+ explicit overrides) ──
const newArg = { ...currentArg, ...(CONFIG.argumentOverrides || {}) };
const profileKey = PROFILE_KEY_ALIASES.find(k => k in currentArg);
if (profileKey) {
  newArg[profileKey] = CONFIG.profilesPerLaunch;
} else if (!Object.keys(CONFIG.argumentOverrides || {}).length) {
  console.error(`\nFATAL: none of the known profiles-per-launch keys exist in this agent's argument.`);
  console.error(`Known aliases: ${PROFILE_KEY_ALIASES.join(', ')}`);
  console.error(`Run --show, find the right key above, and pin it in desired-config.json "argumentOverrides".`);
  process.exit(1);
}

const argChanged = JSON.stringify(newArg) !== JSON.stringify(currentArg);
console.log(`\n[1/2] argument: ${argChanged ? `set ${profileKey || Object.keys(CONFIG.argumentOverrides).join(', ')} → ${profileKey ? CONFIG.profilesPerLaunch : 'overrides'}` : 'already at desired state'}`);

if (argChanged && !DRY) {
  await pb('/agents/save', { method: 'POST', body: JSON.stringify({ id: agent.id, argument: newArg }) });
  console.log('      saved.');
}

// ── 2. Schedule update: daily launch ──
const s = CONFIG.schedule || {};
if (s.enabled) {
  // Cron-style arrays (mirrors PB's "advanced" scheduling UI). If PB rejects
  // this shape, the argument update above has already landed — fix the shape
  // here, or set the schedule once in the UI and read it back with --show.
  const desired = {
    minute: [s.minute ?? 0], hour: [s.hour ?? 8],
    day: [], dow: [], month: [],
    timezone: s.timezone || 'America/Sao_Paulo',
  };
  const already = agent.launchType === 'repeatedly'
    && JSON.stringify(agent.repeatedLaunchTimes?.hour) === JSON.stringify(desired.hour)
    && JSON.stringify(agent.repeatedLaunchTimes?.minute) === JSON.stringify(desired.minute);
  console.log(`[2/2] schedule: ${already ? 'already daily at desired time' : `set launchType=repeatedly, daily ${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')} ${desired.timezone}`}`);
  if (!already && !DRY) {
    try {
      await pb('/agents/save', { method: 'POST', body: JSON.stringify({ id: agent.id, launchType: 'repeatedly', repeatedLaunchTimes: desired }) });
      console.log('      saved.');
    } catch (e) {
      console.error(`      SCHEDULE FAILED (argument update was NOT rolled back): ${e.message}`);
      console.error('      → set the schedule once in the PB UI, run --show, and mirror the exact shape here.');
      process.exit(1);
    }
  }
} else {
  console.log('[2/2] schedule: disabled in desired-config.json — skipped');
}

if (DRY) { console.log('\nDRY RUN — nothing written.'); process.exit(0); }

// ── Verify ──
const after = await pb(`/agents/fetch?id=${encodeURIComponent(agent.id)}`);
const afterArg = parseArgument(after);
const okArg = !profileKey || afterArg[profileKey] === CONFIG.profilesPerLaunch;
const okSched = !s.enabled || after.launchType === 'repeatedly';
console.log(`\nVERIFY: profilesPerLaunch=${profileKey ? afterArg[profileKey] : 'n/a'} launchType=${after.launchType}`);
console.log(`repeatedLaunchTimes: ${JSON.stringify(after.repeatedLaunchTimes ?? null)}`);
if (!okArg || !okSched) { console.error('VERIFY FAILED'); process.exit(1); }
console.log('SYNC OK');
