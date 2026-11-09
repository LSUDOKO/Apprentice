import { open, shot, toast } from './lib.mjs';
const PH = process.argv[2] || 'all';
const { b, p } = await open();
const w = (ms) => p.waitForTimeout(ms);
const btn = (name, o = {}) => p.getByRole('button', { name, ...o });
async function issue(id, title) {
  await p.goto(`http://localhost:8080/issues/${id}?filter=untriaged`);
  await p.getByRole('heading', { name: title }).or(p.locator('h1', { hasText: title })).first().waitFor({ timeout: 30000 }).catch(() => {});
  await w(2000);
}
async function triage(id, title, n) {
  await issue(id, title);
  await shot(p, `t${n}-1-open`, btn('+ needs-info'));
  await btn('+ needs-info').click(); await w(1200);
  await shot(p, `t${n}-2-needsinfo`, btn('+ bug'));
  await btn('+ bug').click(); await w(1200);
  await shot(p, `t${n}-3-bug`, btn(/Request repro/).last());
  await btn(/Request repro/).last().click(); await p.getByRole('dialog').waitFor(); await w(800);
  await shot(p, `t${n}-4-reprodialog`, p.getByRole('dialog').getByRole('button', { name: 'Request repro' }));
  await p.getByRole('dialog').getByRole('button', { name: 'Request repro' }).click(); await w(1500);
  const assign = p.locator('main select').nth(2);
  await shot(p, `t${n}-5-reprodone`, assign);
  await assign.selectOption('triage'); await w(1800);
  await shot(p, `t${n}-6-assigned`, assign);
  console.log('toast', await toast(p));
}
if (PH === 'all' || PH === 'reset') {
  await p.goto('http://localhost:8080/preferences'); await p.getByPlaceholder('owner/name').waitFor();
  await btn('Reset demo…').click(); await w(500); await btn('Reset', { exact: true }).click(); await w(7000);
  await p.goto('http://localhost:8080/issues'); await p.getByText('Recurring job runs twice').first().waitFor({ timeout: 60000 }); await w(1500);
  await shot(p, 'a01-queue', p.getByText('Recurring job runs twice').first());
  await p.goto('http://localhost:8080/preferences'); await p.getByPlaceholder('owner/name').waitFor(); await w(1200);
  const input = p.getByPlaceholder('owner/name'); await input.scrollIntoViewIfNeeded();
  await shot(p, 'a02-import-empty', input);
  await input.fill('BuilderIO/agent-native');
  await shot(p, 'a03-import-typed', btn('Import', { exact: true }));
  await btn('Import', { exact: true }).click();
  await p.locator('[data-sonner-toast]').first().waitFor({ timeout: 60000 }); await w(300);
  await shot(p, 'a04-import-done', p.locator('[data-sonner-toast]').first());
  console.log('toast', await toast(p));
  await p.goto('http://localhost:8080/issues?filter=untriaged'); await w(2500);
  await p.getByPlaceholder('Search title or #number').fill('Error screen'); await w(2500);
  await shot(p, 'a05-queue-real', p.getByText('Error screen: Something went wrong').first());
  await p.goto('http://localhost:8080/issues/gh_BuilderIO_agent-native_8301?filter=untriaged'); await w(3500);
  await shot(p, 'a06-real-issue', p.getByText('What Apprentice sees'));
}
if (PH === 'all' || PH === 'teach') {
  await triage('seed-031', 'Recurring job runs twice', 31);
  await triage('seed-032', 'MCP connector fails to connect', 32);
  await w(1500);
  console.log('BODY after 32:', (await p.locator('body').innerText()).slice(0, 300));
  await issue('seed-033', 'Markdown renders wrong in comments');
  await shot(p, 't33-1-open', btn('+ needs-info'));
  await btn('+ needs-info').click(); await w(2500);
  await shot(p, 't33-2-ghost', p.getByText(/Tab/).first());
  for (let i = 0; i < 3; i++) { await p.keyboard.press('Tab'); await w(2200); await shot(p, `t33-3-tab${i + 1}`, null); }
  console.log('BODY 33:', (await p.locator('main').innerText()).slice(0, 1500));
}

if (PH === 'all' || PH === 'prove') {
  const tab = (n) => p.getByRole('tab', { name: n });
  await p.goto('http://localhost:8080/issues?filter=untriaged'); await btn('Make playbook (my way)').waitFor({ timeout: 30000 }); await w(1500);
  await shot(p, 'p01-pattern', btn('Make playbook (my way)'));
  await btn('Make playbook (my way)').click(); await p.waitForURL(/playbooks\//, { timeout: 30000 }); await w(3500);
  await shot(p, 'p02-editor', tab(/Backtest/));
  await tab(/Backtest/).click(); await p.getByText('Try the trigger').waitFor({ timeout: 30000 });
  await p.getByText('Agreement on matched').waitFor({ timeout: 30000 }); await w(1500);
  const boxes = p.getByRole('checkbox', { name: 'Use this condition' });
  await shot(p, 'p03-backtest', boxes.nth(1));
  await boxes.nth(1).click(); await w(1500); await p.getByText('Agreement on matched').waitFor({ timeout: 30000 }); await w(1500);
  console.log('toggled', (await p.locator('main').innerText()).match(/Considered\s+\d+\s+Matched\s+\d+\s+Agreed\s+\d+/)?.[0]);
  await shot(p, 'p04-backtest-toggled', boxes.nth(1));
  await boxes.nth(1).click(); await w(1500); await p.getByText('Agreement on matched').waitFor({ timeout: 30000 }); await w(800);
  await tab(/Tests/).click(); await w(2000); await shot(p, 'p05-tests', null);
  await tab(/SKILL/).click(); await w(2000); await shot(p, 'p06-skill', null);
  await tab(/Recipe/).click(); await w(1500);
  await shot(p, 'p07-run-btn', btn('Run on untriaged'));
  await btn('Run on untriaged').click(); await p.waitForURL(/review/, { timeout: 30000 }); await w(4000);
  await shot(p, 'r01-shadow', btn(/Approve/).first());
  for (let i = 0; i < 5; i++) {
    const num = (await p.locator('main').innerText()).match(/#\d+ · @[\w-]+/)?.[0];
    console.log('approve', num);
    await p.keyboard.press('a'); await w(1800);
    await shot(p, `r02-approved${i + 1}`, null);
  }
  await p.goto('http://localhost:8080/playbooks'); await w(2500);
  await p.getByText('Needs-info for unversioned bugs').first().click(); await p.waitForURL(/playbooks\/pb_/); await w(3500);
  await shot(p, 'p08-ready', btn(/Promote to/));
  await btn(/Promote to/).click(); await w(2500); console.log('promote', await toast(p));
  await shot(p, 'p09-draft', btn(/Promote to/));
  await btn(/Promote to/).click(); await w(2500); console.log('promote', await toast(p));
  await shot(p, 'p10-act', btn('Run on untriaged'));
  await p.goto('http://localhost:8080/preferences'); await p.getByPlaceholder('owner/name').waitFor(); await w(800);
  await btn('Simulate 4 new issues').click(); await w(3000); console.log('sim', await toast(p));
  await p.goto('http://localhost:8080/playbooks'); await w(2500);
  await p.getByText('Needs-info for unversioned bugs').first().click(); await p.waitForURL(/playbooks\/pb_/); await w(3500);
  await shot(p, 'p11-act-run-btn', btn('Run on untriaged'));
  await btn('Run on untriaged').click(); await p.waitForURL(/review/, { timeout: 30000 }); await w(7000);
  const actUrl = p.url();
  console.log('ACT RUN', actUrl, (await p.locator('main').innerText()).slice(0, 300));
  await shot(p, 'r03-act-run', btn('Undo run'));
  const execNum = (await p.locator('main').innerText()).match(/#(\d+) · @/)?.[1];
  await p.goto('http://localhost:8080/issues?filter=all'); await w(2500);
  const ids = await p.locator('a[href*="/issues/"]').evaluateAll(els => els.map(e => e.getAttribute('href')));
  const href = ids.find(h => h.includes('seed-0' + execNum));
  console.log('why issue', execNum, href);
  await p.goto('http://localhost:8080' + (href || `/issues/seed-0${execNum}`)); await w(3000);
  await shot(p, 'w01-issue-handled', btn('Why?').first());
  await btn('Why?').first().click(); await w(2500);
  await shot(p, 'w02-why', null);
  console.log('WHY', (await p.locator('body').innerText()).match(/Why[\s\S]{0,500}/)?.[0]);
  await p.keyboard.press('Escape'); await w(500);
  await p.goto('http://localhost:8080/review'); await w(3500);
  console.log('review focus', (await p.locator('main').innerText()).match(/#\d+ · @[\w-]+/)?.[0]);
  await shot(p, 'o01-real-8918', btn(/Override/));
  await btn(/Override/).click(); await w(1500);
  const cb = p.getByText("This playbook shouldn't apply here");
  await shot(p, 'o02-override-sheet', cb);
  await cb.click(); await w(800);
  await shot(p, 'o03-noapply', btn('Save override as test'));
  await btn('Save override as test').click(); await w(2500);
  console.log('override toast', await toast(p));
  await shot(p, 'o04-saved-test', p.locator('[data-sonner-toast]').first());
  await p.goto('http://localhost:8080/playbooks'); await w(2500);
  await p.getByText('Needs-info for unversioned bugs').first().click(); await p.waitForURL(/playbooks\/pb_/); await w(3500);
  console.log('PB after override', (await p.locator('main').innerText()).slice(0, 500));
  await shot(p, 'o05-stepped-back', null);
  await p.getByRole('tab', { name: /Tests/ }).click(); await w(2500);
  await shot(p, 'o06-tests-failing', null);
  await p.goto('http://localhost:8080/insights'); await p.getByText('Agreement as you review').waitFor({ timeout: 30000 }); await w(4000);
  await shot(p, 'i01-insights', null);
  await p.mouse.wheel(0, 700); await w(2000); await shot(p, 'i02-insights-lower', null);
  console.log('INSIGHTS', (await p.locator('main').innerText()).slice(0, 700));
  await p.goto(actUrl); await w(4000);
  await shot(p, 'u01-undo-btn', btn('Undo run'));
  await btn('Undo run').click(); await w(1500);
  const conf = p.getByRole('alertdialog').getByRole('button').filter({ hasText: /Undo/ });
  if (await conf.count()) { await shot(p, 'u02-undo-confirm', conf.first()); await conf.first().click(); }
  await w(3000); console.log('undo', await toast(p));
  await shot(p, 'u03-undone', null);
}
if (PH === 'all' || PH === 'explain') {
  console.log('REVIEW BTNS', JSON.stringify(await p.locator('main button').evaluateAll(els => els.map(e => e.innerText.trim().replace(/\s+/g, ' ').slice(0, 40)).filter(Boolean))));
}
await b.close();
