import { open, shot, toast } from './lib.mjs';
const { b, p } = await open();
const w = (ms) => p.waitForTimeout(ms);
// reset
await p.goto('http://localhost:8080/preferences'); await p.getByPlaceholder('owner/name').waitFor();
await p.getByRole('button', { name: 'Reset demo…' }).click(); await w(500);
await p.getByRole('button', { name: 'Reset', exact: true }).click(); await w(7000);
await p.goto('http://localhost:8080/issues'); await p.getByText('Recurring job runs twice').first().waitFor({ timeout: 60000 }); await w(1500);
await shot(p, 'a01-queue', p.getByText('Recurring job runs twice').first());
// import real issues (filmed)
await p.goto('http://localhost:8080/preferences'); await p.getByPlaceholder('owner/name').waitFor(); await w(1200);
const input = p.getByPlaceholder('owner/name');
await input.scrollIntoViewIfNeeded();
await shot(p, 'a02-import-empty', input);
await input.fill('BuilderIO/agent-native');
await shot(p, 'a03-import-typed', p.getByRole('button', { name: 'Import', exact: true }));
await p.getByRole('button', { name: 'Import', exact: true }).click();
await p.locator('[data-sonner-toast]').first().waitFor({ timeout: 60000 }); await w(300);
console.log('toast', await toast(p));
await shot(p, 'a04-import-done', p.locator('[data-sonner-toast]').first());
await p.goto('http://localhost:8080/issues?filter=untriaged'); await w(3000);
await p.getByPlaceholder('Search title or #number').fill('#89'); await w(2000);
console.log((await p.locator('main').innerText()).slice(0, 600));
await shot(p, 'a05-queue-real', p.getByPlaceholder('Search title or #number'));
await b.close();
