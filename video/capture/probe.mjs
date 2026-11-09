import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2, colorScheme: 'dark' });
await p.goto('http://localhost:8080/issues');
await p.waitForTimeout(6000);
console.log(p.url()); console.log((await p.locator('body').innerText()).slice(0,300));
await b.close();
