import { chromium } from 'playwright';
export async function open() {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' });
  const ctx = await b.newContext({ storageState: new URL('./state.json', import.meta.url).pathname, viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2, colorScheme: 'dark' });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8080/issues');
  for (let i = 0; i < 3 && p.url().includes('sign-in') || i === 0 && (await p.getByText('Continue as local dev').isVisible({ timeout: 8000 }).catch(() => false)); i++) {
    await p.getByText('Continue as local dev').click();
    await p.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(3000);
  }
  console.log('login ->', p.url(), (await ctx.cookies()).map((c) => c.name).join(','));
  return { b, p };
}
import fs from 'node:fs';
export const OUT = new URL('../public/shots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const manifestPath = OUT + 'manifest.json';
export const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
export async function shot(p, name, target) {
  await p.mouse.move(-10, -10).catch(() => {});
  await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + name + '.png' });
  let box = null;
  if (target) box = await target.boundingBox().catch(() => null);
  manifest[name] = { box };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  console.log('shot', name, box ? `${Math.round(box.x)},${Math.round(box.y)}` : '');
}
export const toast = async (p) => (await p.locator('[data-sonner-toast]').allInnerTexts()).join(' | ');
