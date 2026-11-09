/**
 * Generates the deterministic demo dataset in server/apprentice/seed/.
 * All content is invented. Run: pnpm seed:generate
 *
 * Layout (see apprentice-build-kit/docs/13-SEED-DATA.md, adapted in PROGRESS.md):
 *   001–012 history: unversioned bugs the demo user triaged as needs-info
 *   013–015 history: unversioned bugs the demo user closed as invalid (backtest disagreements)
 *   016–018 history: unversioned bugs bob@demo.local closed as invalid (Team-mode conflict)
 *   019–022 history: versioned bugs with repro → bug + p2 + component
 *   023–025 history: docs → docs + docs-team;  026–028 features → feature + p3;  029–030 spam → invalid
 *   031–038 live: unversioned bug reports (038 is really a usage question with pasted config)
 *   039–042 live: versioned bugs with repro;  043–046 crash reports with stack traces
 *   047–050 live: duplicates of 005 / 009;  051–054 docs;  055–056 spam;  057–060 feature requests
 *   061–068 incoming: loaded later by the "Simulate new issues" demo action
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

type SeedIssue = {
  id: string;
  number: number;
  title: string;
  body: string;
  author: string;
  authorIsFirstTime: boolean;
  createdHoursAgo: number;
  batch: "history" | "live" | "incoming";
};

type SeedStep = { action: string; args: Record<string, unknown>; afterSec: number };
type SeedEpisode = { issueId: string; actor: "me" | "bob@demo.local"; startedHoursAgo: number; steps: SeedStep[] };
type SeedComment = { issueId: string; author: string; body: string; hoursAgo: number };

const AUTHORS = ["mkato", "devin-r", "lunaops", "pjotr", "sarah-codes", "tobi-io", "ngozi-a", "hikaru", "felixdev", "rosa-m", "quinnbuilds", "amir-k", "jules-p", "wren", "oskar-t"];

const UNVERSIONED_BUGS: [string, string][] = [
  ["Dev server crashes after adding a new action", "I added a new file to `actions/` and now the dev server just dies.\nIt was working fine yesterday. Not sure what changed on my side.\nAny idea what could cause this?"],
  ["Sidebar is blank after login", "After signing in, the agent sidebar shows up empty and nothing loads.\nRefreshing doesn't help. This started this morning."],
  ["Agent replies stop halfway through", "Longer answers from the agent just stop in the middle of a sentence.\nShort replies are fine. Happens most of the time for me."],
  ["Live sync doesn't update the list", "When the agent changes something, my list doesn't update until I reload the page.\nI thought this was supposed to be automatic?"],
  ["Database error when saving a record", "Saving a record fails with a database error toast.\nIt worked on another machine. Really confusing."],
  ["Build fails on deploy", "Deploying to my host fails during the build step, locally everything is fine.\nThe logs mention something about a missing export but I lost them."],
  ["Theme toggle is broken in dark mode", "Switching to dark mode leaves half the screen light.\nLooks really wrong, especially the sidebar."],
  ["Approve button does nothing", "When the agent asks for approval, clicking Approve does nothing at all.\nThe chat just sits there waiting."],
  ["Navigation breaks after opening settings", "If I open settings and go back, the app navigation stops working.\nLinks change the URL but the page doesn't update."],
  ["File upload fails silently", "Uploading a file looks like it works but the file never shows up.\nNo error message anywhere."],
  ["Keyboard shortcuts stop working", "Cmd+K and other shortcuts stop working after a while.\nI have to reload the tab to get them back."],
  ["Agent can't see the current screen", "The agent keeps asking which item I mean even when I'm looking right at it.\nFeels like it doesn't know what's on screen."],
  ["Login loop on Safari", "On Safari I get sent back to the login page over and over.\nChrome works. Not sure what is different."],
  ["Search returns nothing", "Search in my app returns nothing even for words I can see on the page.\nIt used to work."],
  ["Tooltip flickers and freezes the page", "Hovering a tooltip makes it flicker and sometimes the whole page freezes for a second.\nVery annoying."],
  ["Webhooks stopped firing", "My webhooks just stopped firing after an update.\nNothing in the logs that I can find."],
  ["Chat history disappears", "My chat history is gone after restarting the dev server.\nIs that expected? It seems wrong."],
  ["Error toast on every page load", "Every time a page loads I get a red error toast that says something went wrong.\nThe app still works though."],
  ["Recurring job runs twice", "My scheduled job seems to run twice every hour.\nI only created it once."],
  ["MCP connector fails to connect", "Adding the app as a connector in my chat app fails with a generic error.\nI followed the docs."],
  ["Markdown renders wrong in comments", "Code in comments renders as one long line and lists are broken.\nUsed to look fine."],
  ["Agent sidebar stuck on loading", "The agent sidebar spinner never ends. I can't type anything.\nHappens every time I open the app."],
  ["Mobile layout is broken", "On my phone the layout overflows and buttons are cut off.\nDesktop is fine."],
  ["Voice input doesn't start", "Clicking the mic in the composer does nothing.\nI allowed microphone access."],
  ["Copy button copies the wrong text", "The copy button on code blocks copies the wrong snippet.\nIt grabs the one above it."],
];

const VERSIONED_BUGS: [string, string, string][] = [
  ["Action with optional array param fails validation", "core", "@agent-native/core 0.12.3, Node 22.\n\nSteps to reproduce:\n1. Create an action with `z.array(z.string()).optional()`\n2. Call it without the param from the CLI\n\nExpected: the action runs.\nActual: validation error `expected array`."],
  ["CLI `create` ignores --template flag", "cli", "Version: @agent-native/core 0.12.1\n\nSteps to reproduce:\n1. Run `npx @agent-native/core create demo --template mail`\n2. Open the generated app\n\nExpected: mail template.\nActual: default template."],
  ["Drizzle migration runs twice on PGlite", "core", "Using @agent-native/core 0.12.2 with PGlite.\n\nSteps to reproduce:\n1. Add a migration entry\n2. Restart `pnpm dev` twice\n\nExpected: runs once.\nActual: the second start errors with `relation already exists`."],
  ["Sidebar button loses focus ring", "ui", "@agent-native/core 0.12.3\n\nSteps to reproduce:\n1. Tab to the sidebar toggle\n2. Press Enter\n\nExpected: focus ring stays visible.\nActual: focus ring disappears."],
  ["Template sync drops custom routes", "templates", "Version 0.12.0 of @agent-native/core.\n\nSteps to reproduce:\n1. Add `app/routes/reports.tsx`\n2. Run the template sync\n\nExpected: custom route kept.\nActual: the file is removed."],
  ["`pnpm action` hangs when dev server is down", "cli", "@agent-native/core 0.12.4\n\nSteps to reproduce:\n1. Stop the dev server\n2. Run `pnpm action list-items`\n\nExpected: runs against the local DB or errors.\nActual: hangs forever."],
  ["Database query returns stale rows after update", "core", "@agent-native/core 0.12.3, Postgres 16.\n\nSteps to reproduce:\n1. Update a row from an action\n2. Read it back in the same request\n\nExpected: new value.\nActual: old value."],
  ["Dark mode tokens missing in settings pane", "ui", "@agent-native/core 0.12.2\n\nSteps to reproduce:\n1. Switch to dark mode\n2. Open Settings\n\nExpected: dark surfaces.\nActual: white cards on a dark background."],
];

const CRASHES: [string, string][] = [
  ["Server crashes with TypeError in action runner", "@agent-native/core 0.12.3\n\nThe server process exits when calling any action from chat:\n\n```\nTypeError: Cannot read properties of undefined (reading 'userEmail')\n    at runAction (/app/node_modules/@agent-native/core/dist/action.js:412:23)\n    at async handleToolCall (/app/node_modules/@agent-native/core/dist/agent/loop.js:88:11)\n```"],
  ["Crash on startup: migration lock timeout", "@agent-native/core 0.12.4 on Node 22.\n\n```\nError: Migration lock not acquired after 30000ms\n    at acquireLock (/app/node_modules/@agent-native/core/dist/db/migrate.js:57:15)\n    at async runMigrations (/app/node_modules/@agent-native/core/dist/db/migrate.js:102:5)\n```"],
  ["Agent loop crashes when a tool returns a Date", "@agent-native/core 0.12.3\n\n```\nRangeError: Invalid time value\n    at Date.toISOString (<anonymous>)\n    at serializeResult (/app/node_modules/@agent-native/core/dist/agent/serialize.js:31:20)\n```"],
  ["SSR crash: window is not defined", "@agent-native/core 0.12.2\n\n```\nReferenceError: window is not defined\n    at useRecorder (/app/node_modules/@agent-native/core/dist/client/recorder.js:14:9)\n    at renderToPipeableStream (/app/node_modules/react-dom/server.js:120:3)\n```"],
];

const DUPLICATES: [string, string][] = [
  ["Saving fails with a database error (0.12.3)", "seed-005"],
  ["DB error toast when I save — @agent-native/core 0.12.3", "seed-005"],
  ["Approve in chat is unresponsive on 0.12.4", "seed-009"],
  ["Clicking Approve doesn't continue the agent run, version 0.12.3", "seed-009"],
];

const DOCS: [string, string][] = [
  ["Typo in the actions docs", "The page on defining actions says `defineActon` in the second example."],
  ["Docs: deploy guide links to a missing page", "The documentation link to the Netlify guide is a 404."],
  ["README quick start uses an old command", "The README still says `npm run start-dev`, the guide uses `pnpm dev`."],
  ["Documentation for recurring jobs is unclear", "The docs don't explain where jobs are stored or how to run one now."],
  ["Typo in the sharing guide", "\"permisions\" should be \"permissions\" in the sharing documentation."],
  ["Docs: missing example for useDbSync realtime", "The client data documentation mentions realtime but has no example."],
  ["Tutorial step 3 screenshot is outdated", "The tutorial screenshot shows the old sidebar."],
];

const SPAM: [string, string][] = [
  ["Best crypto giveaway, click here", "Free money for everyone!! https://example.invalid/a https://example.invalid/b https://example.invalid/c click here now"],
  ["Cheap SEO services for your repo", "We offer cheap SEO services and buy followers packages. https://example.invalid/seo https://example.invalid/deal https://example.invalid/x"],
  ["Discount loan offer", "Get a discount loan today https://example.invalid/1 https://example.invalid/2 https://example.invalid/3"],
  ["Casino bonus for developers", "Casino bonus, click here: https://example.invalid/c1 https://example.invalid/c2 https://example.invalid/c3"],
];

const FEATURES: [string, string][] = [
  ["Feature request: export audit log as JSON", "It would be nice to export the audit log as JSON as well as CSV."],
  ["Please add a way to pin chat threads", "Could we pin important chat threads to the top of the sidebar?"],
  ["Support for custom fonts in the design system", "Feature request: allow custom font families in the design tokens."],
  ["Feature request: bulk actions in lists", "Please add a way to select many rows and run one action on all of them."],
  ["Proposal: keyboard shortcut editor", "Would be nice to rebind keyboard shortcuts from settings."],
  ["Feature request: Slack threads for digests", "Could we post digests as threads instead of new messages?"],
  ["Please add dark mode screenshots to docs", "Feature request: show both themes in the screenshots."],
];

const QUESTION_WITH_CONFIG: [string, string] = [
  "Is this a bug? Sidebar errors with my config",
  "Not sure if this is a bug or my setup — the sidebar shows an error with this config:\n\n```ts\nexport default defineAgentNativeConfig({ harness: true, sidebar: { width: 'wide' } });\n```\n\nIs `sidebar.width` supposed to accept a string?",
];

let n = 0;
const issues: SeedIssue[] = [];
function add(batch: SeedIssue["batch"], title: string, body: string, createdHoursAgo: number, firstTime = false) {
  n += 1;
  const id = `seed-${String(n).padStart(3, "0")}`;
  issues.push({ id, number: n, title, body, author: AUTHORS[(n * 7) % AUTHORS.length]!, authorIsFirstTime: firstTime, createdHoursAgo, batch });
  return id;
}

const hist = (i: number) => 24 * 28 - i * 20; // spread over the past ~4 weeks
const live = (i: number) => 40 - i; // within the last 2 days

// 001–018: unversioned bugs (history)
for (let i = 0; i < 18; i++) add("history", UNVERSIONED_BUGS[i]![0], UNVERSIONED_BUGS[i]![1], hist(i), i % 5 === 0);
// 019–022: versioned bugs (history)
for (let i = 0; i < 4; i++) add("history", VERSIONED_BUGS[i]![0], VERSIONED_BUGS[i]![2], hist(18 + i));
// 023–025 docs, 026–028 features, 029–030 spam (history)
for (let i = 0; i < 3; i++) add("history", DOCS[i]![0], DOCS[i]![1], hist(22 + i));
for (let i = 0; i < 3; i++) add("history", FEATURES[i]![0], FEATURES[i]![1], hist(25 + i));
for (let i = 0; i < 2; i++) add("history", SPAM[i]![0], SPAM[i]![1], hist(28 + i), true);
// 031–037 live unversioned bugs, 038 the disguised question
for (let i = 0; i < 7; i++) add("live", UNVERSIONED_BUGS[18 + i]?.[0] ?? UNVERSIONED_BUGS[i]![0], UNVERSIONED_BUGS[18 + i]?.[1] ?? UNVERSIONED_BUGS[i]![1], live(i), i === 2);
add("live", QUESTION_WITH_CONFIG[0], QUESTION_WITH_CONFIG[1], live(7), true);
// 039–042 versioned bugs, 043–046 crashes
for (let i = 4; i < 8; i++) add("live", VERSIONED_BUGS[i]![0], VERSIONED_BUGS[i]![2], live(8 + i - 4));
for (let i = 0; i < 4; i++) add("live", CRASHES[i]![0], CRASHES[i]![1], live(12 + i));
// 047–050 duplicates
for (let i = 0; i < 4; i++) {
  const [title, of] = DUPLICATES[i]!;
  const original = issues.find((x) => x.id === of)!;
  add("live", title, `Same as ${original.title.toLowerCase()}? Running @agent-native/core 0.12.3.\n\n${original.body}`, live(16 + i));
}
// 051–054 docs, 055–056 spam, 057–060 features
for (let i = 3; i < 7; i++) add("live", DOCS[i]![0], DOCS[i]![1], live(20 + i - 3));
for (let i = 2; i < 4; i++) add("live", SPAM[i]![0], SPAM[i]![1], live(24 + i - 2), true);
for (let i = 3; i < 7; i++) add("live", FEATURES[i]![0], FEATURES[i]![1], live(26 + i - 3));

// 061–068 incoming batch: 5 unversioned bugs, 1 versioned, 1 docs, 1 feature
const INCOMING_BUGS: [string, string][] = [
  ["Extensions page crashes the tab", "Opening the extensions page makes the whole tab unresponsive.\nHappened twice today."],
  ["Notifications never arrive", "I never get notifications even though they are enabled.\nNot sure where to look."],
  ["Agent forgets the selected rows", "I select rows and ask the agent to act on them, but it says nothing is selected.\nThis worked before."],
  ["Export button downloads an empty file", "Clicking export gives me an empty file every time.\nThe data is definitely there."],
  ["Org switcher shows the wrong workspace", "After switching orgs the header still shows the old workspace name.\nData seems mixed up."],
];
for (let i = 0; i < 5; i++) add("incoming", INCOMING_BUGS[i]![0], INCOMING_BUGS[i]![1], 0);
add("incoming", "Dark mode chart colors unreadable", "@agent-native/core 0.12.4\n\nSteps to reproduce:\n1. Switch to dark mode\n2. Open a chart\n\nExpected: readable colors.\nActual: dark grey on black.", 0);
add("incoming", "Typo in the evals docs", "The documentation for evals says `usesTol` instead of `usesTool`.", 0);
add("incoming", "Feature request: per-playbook notifications", "It would be nice to get notified per playbook, not globally.", 0);

// ---- History episodes ----
const episodes: SeedEpisode[] = [];
const comments: SeedComment[] = [];
const issueById = (id: string) => issues.find((x) => x.id === id)!;
const reproMessage = (author: string) =>
  `Thanks for the report, @${author}! Could you share the \`@agent-native/core\` version and the exact steps to reproduce from a fresh template?`;

const ids = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `seed-${String(from + i).padStart(3, "0")}`);

ids(1, 12).forEach((id, i) => {
  const issue = issueById(id);
  episodes.push({
    issueId: id,
    actor: "me",
    startedHoursAgo: issue.createdHoursAgo - 2,
    steps: [
      { action: "label-issue", args: { add: ["bug", "needs-info"], remove: [] }, afterSec: 20 + (i % 4) * 15 },
      { action: "request-repro", args: { missing: ["version", "steps"], message: reproMessage(issue.author) }, afterSec: 60 + (i % 3) * 30 },
      { action: "assign-issue", args: { assignee: "triage" }, afterSec: 15 + (i % 5) * 10 },
    ],
  });
  if (i % 3 === 0) {
    comments.push({ issueId: id, author: issue.author, body: "Sorry! I'm on `@agent-native/core 0.12.2`. I'll try to put together a minimal repro this week.", hoursAgo: issue.createdHoursAgo - 20 });
  }
});
ids(13, 15).forEach((id, i) =>
  episodes.push({
    issueId: id,
    actor: "me",
    startedHoursAgo: issueById(id).createdHoursAgo - 3,
    steps: [
      { action: "label-issue", args: { add: ["invalid"], remove: [] }, afterSec: 30 + i * 10 },
      { action: "close-issue", args: { reason: "invalid" }, afterSec: 25 },
    ],
  }),
);
ids(16, 18).forEach((id, i) =>
  episodes.push({
    issueId: id,
    actor: "bob@demo.local",
    startedHoursAgo: issueById(id).createdHoursAgo - 1,
    steps: [
      { action: "label-issue", args: { add: ["invalid"], remove: [] }, afterSec: 25 + i * 5 },
      { action: "close-issue", args: { reason: "invalid" }, afterSec: 20 },
    ],
  }),
);
const COMPONENT_OF = ["core", "cli", "core", "ui"];
ids(19, 22).forEach((id, i) =>
  episodes.push({
    issueId: id,
    actor: "me",
    startedHoursAgo: issueById(id).createdHoursAgo - 2,
    steps: [
      { action: "label-issue", args: { add: ["bug"], remove: [] }, afterSec: 30 },
      { action: "set-priority", args: { priority: "p2" }, afterSec: 40 },
      { action: "set-component", args: { component: COMPONENT_OF[i] }, afterSec: 35 },
    ],
  }),
);
ids(23, 25).forEach((id) =>
  episodes.push({
    issueId: id,
    actor: "me",
    startedHoursAgo: issueById(id).createdHoursAgo - 4,
    steps: [
      { action: "label-issue", args: { add: ["docs"], remove: [] }, afterSec: 20 },
      { action: "assign-issue", args: { assignee: "docs-team" }, afterSec: 25 },
    ],
  }),
);
ids(26, 28).forEach((id) =>
  episodes.push({
    issueId: id,
    actor: "me",
    startedHoursAgo: issueById(id).createdHoursAgo - 5,
    steps: [
      { action: "label-issue", args: { add: ["feature"], remove: [] }, afterSec: 30 },
      { action: "set-priority", args: { priority: "p3" }, afterSec: 20 },
    ],
  }),
);
ids(29, 30).forEach((id) =>
  episodes.push({
    issueId: id,
    actor: "me",
    startedHoursAgo: issueById(id).createdHoursAgo - 1,
    steps: [
      { action: "label-issue", args: { add: ["invalid"], remove: [] }, afterSec: 10 },
      { action: "close-issue", args: { reason: "invalid" }, afterSec: 10 },
    ],
  }),
);

const out = path.resolve(import.meta.dirname, "../server/apprentice/seed");
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "issues.json"), `${JSON.stringify({ repo: "demo/agent-native", issues }, null, 2)}\n`);
writeFileSync(path.join(out, "history.json"), `${JSON.stringify({ episodes, comments }, null, 2)}\n`);
console.log(`Wrote ${issues.length} issues, ${episodes.length} episodes, ${comments.length} comments to ${out}`);
