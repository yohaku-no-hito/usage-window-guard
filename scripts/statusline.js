#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const c = require(path.join(__dirname, 'common.js'));
let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch {}
const fresh = c.extractFromStdin(input);
if (fresh) c.writeJsonSafe(c.CACHE_FILE, { fetchedAt: Date.now(), usage: fresh });
const model = input?.model?.display_name || input?.model?.id || '';
const cwdName = path.basename(input?.workspace?.current_dir || process.cwd());
const parts = [model, cwdName].filter(Boolean);
const cached = c.readJsonSafe(c.CACHE_FILE, null);
const usage = fresh || (cached ? cached.usage : null);
if (usage) {
  const f = usage.five_hour, s = usage.seven_day;
  if (f && f.utilization != null) parts.push(`5h ${Math.round(f.utilization)}%${f.resetsAt ? ` -> ${c.fmtReset(f.resetsAt)}` : ''}`);
  if (s && s.utilization != null) parts.push(`7d ${Math.round(s.utilization)}%${s.resetsAt ? ` -> ${c.fmtReset(s.resetsAt)}` : ''}`);
} else {
  parts.push('usage: /usage de kakunin');
}
process.stdout.write(parts.join('  |  '));
