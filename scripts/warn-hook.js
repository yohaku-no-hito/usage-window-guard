#!/usr/bin/env node
'use strict';
const path = require('path');
const c = require(path.join(__dirname, 'common.js'));
const config = c.loadConfig();
const cache = c.readJsonSafe(c.CACHE_FILE, null);
if (!cache || !cache.usage || (Date.now() - (cache.fetchedAt || 0)) / 1000 > config.maxCacheAgeSec) {
  process.stdout.write('{}');
  process.exit(0);
}
const state = c.readJsonSafe(c.STATE_FILE, {});
const warnings = [];
function check(label, en, w) {
  if (!w || w.utilization == null) return;
  const resetsAt = w.resetsAt || 'unknown';
  let ws = state[label];
  if (!ws || ws.resetsAt !== resetsAt) ws = { resetsAt, warned: [] };
  const crossed = config.thresholds.filter((t) => w.utilization >= t && !ws.warned.includes(t));
  if (crossed.length) {
    const top = Math.max(...crossed);
    ws.warned = [...new Set([...ws.warned, ...crossed])];
    const reset = w.resetsAt ? ` (resets: ${c.fmtReset(w.resetsAt)})` : '';
    warnings.push(`⚠ ${en} usage reached ${top}%${reset}`);
  }
  state[label] = ws;
}
check('five_hour', '5-hour window', cache.usage.five_hour);
check('seven_day', '7-day window', cache.usage.seven_day);
c.writeJsonSafe(c.STATE_FILE, state);
if (!warnings.length) {
  process.stdout.write('{}');
  process.exit(0);
}
const message = warnings.join('\n');
process.stdout.write(JSON.stringify({
  systemMessage: message,
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit',
    additionalContext: `[usage-guard]\n${message}\n\nRepeat the warning above to the user exactly as written, one line per warning. Do not rephrase or change symbols or numbers.`,
  },
}));
