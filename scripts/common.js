'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const CONFIG_ROOT = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const DIR = path.join(CONFIG_ROOT, 'usage-guard');
const CACHE_FILE = path.join(DIR, 'cache.json');
const CONFIG_FILE = path.join(DIR, 'config.json');
const STATE_FILE = path.join(DIR, 'state.json');
function readJsonSafe(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } }
function writeJsonSafe(f, data) { try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data)); } catch {} }
function loadConfig() { return Object.assign({ thresholds: [70, 85, 95], maxCacheAgeSec: 900 }, readJsonSafe(CONFIG_FILE, {})); }
function extractFromStdin(input) {
  const rl = input && (input.rate_limits || input.rateLimits);
  if (!rl) return null;
  // Claude Code 2.1.x observed shape: { five_hour: { used_percentage: 24, resets_at: 1788861000 } }
  // older/other shapes kept as fallbacks
  const norm = (w) => (w ? { utilization: w.used_percentage ?? w.usedPercentage ?? w.utilization ?? w.percentage ?? null, resetsAt: w.resets_at ?? w.resetsAt ?? null } : null);
  const five = norm(rl.five_hour || rl.fiveHour);
  const seven = norm(rl.seven_day || rl.sevenDay);
  if (!five && !seven) return null;
  return { five_hour: five, seven_day: seven };
}
// resets_at comes as unix SECONDS in the observed shape; accept ms and ISO strings too
function toDate(t) {
  if (t === null || t === undefined || t === '') return null;
  const s = String(t);
  if (/^\d+$/.test(s)) { const n = Number(s); return new Date(n < 1e12 ? n * 1000 : n); }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function fmtReset(t) {
  const d = toDate(t);
  if (!d || isNaN(d.getTime())) return '';
  try { return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}
module.exports = { DIR, CACHE_FILE, CONFIG_FILE, STATE_FILE, readJsonSafe, writeJsonSafe, loadConfig, extractFromStdin, fmtReset, toDate };
