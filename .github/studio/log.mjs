import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const REPO = 'SeonUBae/Body-ios';
const OUT = 'events.json';
const DAYS = 14;
const token = process.env.STUDIO_READ_TOKEN;
if (!token) { console.log('no token, skipping'); process.exit(0); }

const KINDS = ['work', 'pass', 'reject', 'ship', 'copy', 'approve'];
const since = new Date(Date.now() - DAYS * 864e5).toISOString();
const day = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(t));

async function get(path) {
  const r = await fetch('https://api.github.com' + path, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!r.ok) throw new Error('request failed: ' + r.status);
  return r.json();
}

const rows = new Map();
const add = (t, kind) => {
  const d = day(t);
  if (!rows.has(d)) rows.set(d, Object.fromEntries([['d', d], ...KINDS.map(k => [k, 0])]));
  rows.get(d)[kind]++;
};

const branches = (await get(`/repos/${REPO}/branches?per_page=100`)).map(b => b.name)
  .filter(n => n === 'main' || /^(claude|combi|honi|buzzi)\//.test(n));
const seen = new Set();
for (const b of branches) {
  for (let page = 1, list; page <= 10 && (list = await get(`/repos/${REPO}/commits?sha=${encodeURIComponent(b)}&since=${since}&per_page=100&page=${page}`)).length; page++)
  for (const c of list) {
    if (seen.has(c.sha) || (c.parents || []).length > 1) continue;
    seen.add(c.sha);
    const who = ((c.commit && c.commit.author && c.commit.author.name) || '').toLowerCase();
    const t = c.commit && c.commit.author && c.commit.author.date;
    if (!t) continue;
    if (who === 'honi') add(t, 'copy');
    else if (who !== 'buzzi') add(t, 'work');
  }
}

const runs = [];
for (let page = 1, list; page <= 10 && (list = (await get(`/repos/${REPO}/actions/runs?per_page=100&page=${page}&created=>=${since.slice(0, 10)}`)).workflow_runs || []).length; page++) runs.push(...list);
for (const r of runs) {
  if (r.status !== 'completed') continue;
  if (r.name === 'CI') { if (r.conclusion === 'success') add(r.updated_at, 'pass'); else if (r.conclusion === 'failure') add(r.updated_at, 'reject'); }
  if (r.name === 'TestFlight' && r.conclusion === 'success') add(r.updated_at, 'ship');
  if (r.name === 'App Store listing' && r.conclusion === 'success') add(r.updated_at, 'approve');
}

const days = [...rows.values()].sort((a, b) => (a.d < b.d ? -1 : 1));
const next = JSON.stringify({ v: 1, days }, null, 1) + '\n';
const prev = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
if (next === prev) { console.log('no change'); process.exit(0); }
writeFileSync(OUT, next);
console.log('days: ' + days.length);
