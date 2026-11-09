import { open } from './lib.mjs';
const { b, p } = await open();
await p.goto('http://localhost:8080/issues?filter=all'); await p.waitForTimeout(3000);
await p.getByPlaceholder('Search title or #number').fill('sidebar'); await p.waitForTimeout(2500);
console.log((await p.locator('main').innerText()).slice(0,1200));
await b.close();
