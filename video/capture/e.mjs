import { open, shot, toast } from './lib.mjs';
const { b, p } = await open();
const w = (ms) => p.waitForTimeout(ms);
const btn = (name, o = {}) => p.getByRole('button', { name, ...o });
await p.goto('http://localhost:8080/review'); await w(4000);
console.log(p.url());
await shot(p, 'e01-review', btn(/Approve/).first());
for (let i = 0; i < 8; i++) {
  const t = await p.locator('main h2, main h1').allInnerTexts().catch(() => []);
  const num = (await p.locator('main').innerText()).match(/#\d+ · @[\w-]+/)?.[0];
  console.log(i, num, t.slice(0, 2).join(' / '));
  await p.keyboard.press('a'); await w(2200);
  if (i === 0) await shot(p, 'e02-approved1', null);
  console.log('  toast', await toast(p));
}
await shot(p, 'e03-reviewed', null);
console.log((await p.locator('main').innerText()).slice(0, 500));
await b.close();
