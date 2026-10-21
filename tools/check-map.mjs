import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
const problems = [];

try { new vm.Script(script); } catch (e) { problems.push('스크립트를 읽을 수 없어요: ' + e.message); }

const grab = (name, open, close) => {
  const a = script.indexOf(`const ${name}=`);
  if (a < 0) throw new Error(name + ' not found');
  let i = script.indexOf(open, a), depth = 0;
  for (let j = i; j < script.length; j++) {
    if (script[j] === open) depth++;
    if (script[j] === close && --depth === 0) return vm.runInNewContext('(' + script.slice(i, j + 1) + ')');
  }
  throw new Error(name + ' not closed');
};
const num = name => +script.match(new RegExp(`${name}=(\\d+)`))[1];

const BLOCK = grab('BLOCK', '[', ']'), P = grab('P', '{', '}');
const W = 256, H = 448, CELL = num('CELL'), PADX = num('PADX'), PADY = num('PADY');
const GW = W / CELL, GH = H / CELL, grid = new Uint8Array(GW * GH);
for (const [x0, y0, x1, y1] of BLOCK)
  for (let gy = Math.max(0, Math.floor((y0 - PADY) / CELL)); gy < Math.min(GH, Math.ceil((y1 + PADY) / CELL)); gy++)
    for (let gx = Math.max(0, Math.floor((x0 - PADX) / CELL)); gx < Math.min(GW, Math.ceil((x1 + PADX) / CELL)); gx++) grid[gy * GW + gx] = 1;
const free = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && !grid[y * GW + x];
const near = (gx, gy) => {
  if (free(gx, gy)) return [gx, gy];
  for (let r = 1; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (free(gx + dx, gy + dy)) return [gx + dx, gy + dy];
  return null;
};

const SEATED = new Set(['sofaSit']);
const names = Object.keys(P).filter(n => !SEATED.has(n));
const cell = n => near(Math.floor(P[n][0] / CELL), Math.floor(P[n][1] / CELL));
const start = cell(names[0]), seen = new Set([start.join()]), q = [start];
while (q.length) {
  const [x, y] = q.shift();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const k = (x + dx) + ',' + (y + dy);
    if (free(x + dx, y + dy) && !seen.has(k)) { seen.add(k); q.push([x + dx, y + dy]); }
  }
}
for (const n of names) {
  const c = cell(n);
  if (!c) { problems.push(`${n}: 근처에 설 수 있는 자리가 없어요`); continue; }
  if (!seen.has(c.join())) problems.push(`${n}: 다른 장소에서 걸어갈 수 없어요`);
  const d = Math.hypot(c[0] * CELL + 1 - P[n][0], c[1] * CELL + 1 - P[n][1]);
  if (d > 4) problems.push(`${n}: 가구 안쪽에 있어요 (${d.toFixed(1)}px)`);
}

if (problems.length) {
  console.log('검사를 통과하지 못했어요.');
  for (const p of problems) console.log('- ' + p);
  process.exit(1);
}
console.log(`검사를 통과했어요. 장소 ${names.length}곳 모두 걸어서 갈 수 있어요.`);
