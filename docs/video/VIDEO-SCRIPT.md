# Apprentice — Launch Film Script & Shot List

> **Published:** https://clips.agent-native.com/share/77mChMteEQ6M
>
> Final cut: **3:00** (180.75 s) · 1920×1080 (master 2560×1440 for zooms) · 60 fps · H.264 · −14 LUFS
> Event: Builder.io **Agent-Native Hackathon** — deadline **Mon Nov 9 2026, 11:59 PM PT**
> Delivery: upload the final MP4 to **clips.agent-native.com** (Clips accepts video uploads), set it **Public**, paste the link in the submission form.

---

## 0. Project inputs (filled)

| Field | Value |
|---|---|
| Product | **Apprentice** |
| One-line pitch | The agent that learns your issue triage by watching you work, proves it with backtests and regression tests, then earns autonomy on a trust ladder. |
| Tagline | **Show it once. Delegate forever.** |
| Event / judging | Agent-Native Hackathon — Usefulness & Execution 40% · Creativity & Design 20% · Innovation 20% · Cleverness & Use of Agent-Native 20% (judges score 0–10 per criterion) |
| Core tech to showcase | **Agent-Native** — typed actions shared by UI and agent, `needsApproval` gate, screen context (`view-screen`), skills, MCP |
| Why it matters | In Agent-Native, a button click and an agent tool call are the *same typed action*. So every click Maya makes is already a structured demonstration. Apprentice records those, finds the repeat, and replays it through the same actions — gated by the framework's approval hook. No screen scraping, no guessing. |
| Target user | Open-source maintainers and support/triage leads who process the same kinds of issues every day |
| Live app | https://apprentice-agent.onrender.com (wake it 2 min before recording) |
| Website | https://apprentice-agent.pages.dev |
| Repo | https://github.com/LSUDOKO/Apprentice |
| Account | fresh sign-up → **Load demo data** (or `judge@apprentice-demo.dev` / `apprentice-demo-2026`, then Settings → **Reset demo**) |
| Data (hybrid) | **Demo history** (invented, needed for backtest / team conflict) **+ 30 real open issues imported live from `github.com/BuilderIO/agent-native`** via Settings → Data → Import (read-only, never writes to GitHub). Real issues that appear on screen: #8301 and #8141 "Error screen: Something went wrong" (real needs-info cases, handled by the playbook) and #8918 "Let designated admins create organizations…" (a real feature request the rule wrongly matched → overridden → regression test). |
| Length | 3:00–3:30 (plan: 3:15) |
| VO | English, calm-confident founder voice |

### Brand system (use these only — no tool defaults)

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0B0D08` | Every background. Near-black olive. |
| `surface` | `#13160E` | Cards, browser frame, callout chips |
| `line` | `#2A2F1D` | Grid lines, borders, node edges (idle) |
| `text` | `#ECEEDF` | Headlines, VO captions |
| `text-dim` | `#B8BEA6` | Secondary lines |
| `muted` | `#8E957D` | Mono micro-labels, crosshair `+` marks |
| **`lime` (hero)** | **`#DDF26B`** | ONLY for "solution / answer / action": the orb, the active caption word, click ripples, the moment something gets learned |
| `ok` | `#B5E655` | Agreed / passing |
| `warn` | `#F5C451` | Needs you / pending |
| `bad` | `#FF7A6B` | Override / broken test / the problem act |
| `param-fixed` | `#B4B9A4` | "Fixed" parameter chips |
| `param-item` | `#5EEAD4` | "From the issue" parameter chips |
| `param-agent` | `#C4B5FD` | "Agent decides" parameter chips |

- **Fonts:** Geist 600 (headlines, tracking −0.045em, line-height 0.95) · Geist 400/500 (body, captions) · Geist Mono 400/500 (micro-labels, code, timestamps, uppercase tracking +0.12em ONLY for small labels).
- **Logo:** the "A" mark from `docs/brand/banner.html` (lime A on `#13160E` rounded square, r=14/64). Wordmark "Apprentice" Geist 500.
- **Signature visuals:** 80 px grid at 5% opacity · lime orb with inset highlight + glow · film grain 12% overlay · `+` crosshair marks on grid intersections · liquid-glass buttons/chips (blur 14 px, saturate 160%).
- **Radius:** 6 px (matches app `--radius: 0.375rem`) for chips/cards; 14 px for the browser frame.
- **Safe margins:** 96 px. Headline max 6 words on screen.

### Honesty rules (judges can disqualify "fabricated demonstrations")
- Every UI shot is the **real app** recorded on the live deployment. No mocked screens.
- Numbers on screen come from the app itself (backtest counts, test counts, Insights). Read the real values off your recording; if they differ from this script, **use the recorded value**.
- The demo data is invented (60 issues, teammate "bob"). Every walkthrough shot carries a mono tag under the browser frame: "demo data · local app" or "real open issues · github.com/BuilderIO/agent-native · read-only".
- No external industry stats unless you add a verified source on screen. The script below uses none.
- Don't show the agent chat unless an LLM key with enough quota is set (Groq free tier rejects agent turns). Everything in the walkthrough works without it.

---

## 1. Creative brief

**Logline:** A maintainer who does the same triage clicks a hundred times teaches an agent once, and the agent has to *prove* it learned before it's allowed to act.

**Protagonist:** **Maya**, maintainer of a busy open-source project. Monday morning, 60 new issues. Half are "it's broken" with no version, no steps.

**Emotional arc:** repetition → frustration → "wait, it noticed" → skepticism ("can I trust it?") → proof (backtest, tests, review) → earned trust → relief, Maya closes her laptop at lunch.

**Three key messages**
1. **It learns from what you already do.** No prompts, no workflow builder — your clicks are the lesson.
2. **It proves it before it acts.** Backtest on your history, every correction becomes a test, autonomy is earned one rung at a time.
3. **It's Agent-Native all the way down.** The UI and the agent share the same typed actions, so a demonstration and an execution are literally the same call.

---

## 2. Transition vocabulary (where each of the 13 is used)

All transitions are motivated by what's on screen. Durations at 60 fps.

| # | Transition | Where | Spec |
|---|---|---|---|
| 1 | **Standard cut** | Default inside walkthrough steps | Hard cut on the beat; cut on cursor motion so the eye carries over |
| 2 | **Jump cut** | Problem act, Maya doing the same 4 clicks on 3 issues | Same framing, 3 cuts, 6–8 frames apart, issue number changes each time (#12, #19, #27) |
| 3 | **L-cut / J-cut** | Every section turn | J-cut: next section's VO/sound starts 8–12 frames before picture. L-cut: keyboard clicks from Act 3 carry under the title reveal |
| 4 | **Cross dissolve** | Only twice: into Under-the-hood, and into the final return-to-Maya | 20 frames, ease-in-out, with 4 px blur at midpoint. Never elsewhere |
| 5 | **Wipe** | Backtest toggle reveal; Before/After split in Impact | Linear-gradient mask wipe, 18 frames, `cubic-bezier(0.16,1,0.3,1)`, lime 2 px leading edge |
| 6 | **Film roll-in** | Opening of walkthrough (browser frame enters) | Frame slides up from y+120 with 6° X-tilt → 0°, 30 frames, slight motion blur + grain bump |
| 7 | **Cross zoom** | Pattern card → Playbook editor; Insights KPI → Impact counters | Scale 1→1.8 into the clicked element with radial blur 8 px, cut, next shot 1.8→1, total 16 frames |
| 8 | **Light leak & glitch** | Glitch: the override moment (red) and the "promotion blocked" test failure. Light leak: logo reveal and the trust-ladder "Act" moment | Glitch: 6 frames RGB split 6 px + 2 scanline slices, `bad` tint. Light leak: lime/warm leak, screen blend, 40% max, 24 frames |
| 9 | **Pan** | Queue overview, Insights dashboard, Under-the-hood graph | Slow lateral drift 40–80 px over the shot, never stops (continuous parallax) |
| 10 | **Whip** | Problem → Painkiller; Review → Trust ladder | 10-frame directional blur whip (60 px blur), matched direction in/out, whoosh SFX |
| 11 | **Object block** | Title → Problem (a giant "A" mark slides across and reveals the next scene); Under-the-hood → Impact (a node fills the frame) | Foreground shape passes the lens over 14 frames, cut hidden behind it |
| 12 | **Breaker clip** | Between Problem and Painkiller, and before Outro | 1–1.5 s kinetic type card on `bg`: "Again." / "Show it once." — a palate cleanser on a beat drop |
| 13 | **Timelapse** | Problem: clock + issue counter racing 9:00 → 12:40 while issues pile up; Impact: autopilot running through a batch | Speed-ramp 8× with frame blending, ticking SFX sped up, ramp back to 1× on the beat |

### Motion language ("butter" spec)
- **Easing:** entrances `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) 300–500 ms; exits `cubic-bezier(0.7, 0, 0.84, 0)` 200–300 ms; camera moves `cubic-bezier(0.65, 0, 0.35, 1)`. Never linear (except timelapse playback).
- **Springs** (Remotion `spring`): `damping 200, mass 0.6` for UI chips (no bounce); `damping 14, stiffness 120` only for the logo and the lime "learned" pulse (one small overshoot).
- **Text:** word-by-word mask reveal, Y +28 px → 0, blur 8 px → 0, 40 ms stagger. Hold ≈ 0.3 s/word + 0.5 s.
- **Motion blur** on everything that moves > 20 px/frame (Remotion `<CameraMotionBlur samples={8}>` or 180° shutter in post).
- **60 fps render**, no frame-step animation. Sub-pixel transforms only (`translate3d`), no integer snapping.
- **One focal point per frame.** Secondary motion at ≤ 40% amplitude.
- **Continuous drift:** every static shot drifts 1.5% scale or 40 px over its duration.

### Cinematic cursor & camera (walkthrough)
- Cursor: custom arrow in `text` with 1 px `bg` outline, 22 px. Paths are cubic béziers between logged click targets with 6–10% overshoot and settle (12 frames). Hide the real cursor during capture.
- Click: press-scale 0.85× (120 ms), lime ripple ring 0 → 48 px, opacity 0.6 → 0, soft click SFX.
- Keyboard: Apprentice is keyboard-first — show a glass key chip bottom-left (`J`, `Tab`) in Geist Mono on every shortcut.
- Auto-zoom (Screen Studio style): 1.4–2.2× toward the action, 24-frame eased move, follow cursor with 0.15 lerp, zoom back out between steps.
- Spotlight: dim everything else to 35% with a 12 px feathered mask on the element the VO names.
- Callouts: 2–5 word glass chips that pop in next to the element on the VO word, in brand style.
- Frame: recording inside a browser mockup (`surface`, 14 px radius, 1 px `line` border, 60 px soft lime-tinted shadow at 15%) floating on the brand grid with the orb blurred behind it.

---

## 3. Script + shot list

VO total ≈ 470 words. Time codes are targets; lock picture to the final VO.

### ACT 1 — Cold open / hook · 0:00–0:10

| TC | VO | Visual | Motion / transition | SFX / music |
|---|---|---|---|---|
| 0:00 | *(silence, keys)* | Black `bg`. A single mono line types: `label: needs-info` | Typed at real keystroke rhythm | Mechanical key clicks, close-mic |
| 0:02 | "Maya has clicked this sequence a hundred times." | Jump-cut ×3: the same 4 triage actions on issues #12, #19, #27, real UI, tight crop | **Jump cut** (#2), 8 frames apart, each cut on a key click | Clicks get louder, low drone enters |
| 0:07 | "Today, it'll be a hundred and one." | Kinetic: **"Again."** 160 px Geist 600, `text` | Word slams in, Y+28 → 0, blur → sharp | Sub-bass hit, cut to silence |

### ACT 2 — Title reveal · 0:10–0:18

| TC | VO | Visual | Motion / transition | SFX / music |
|---|---|---|---|---|
| 0:10 | *(none)* | The grid draws in from center, `+` crosshairs pop on intersections. Lime orb rises from bottom-right | Grid lines stroke-draw 20 frames, staggered | Riser |
| 0:13 | — | "A" mark builds: rounded square scales up, the A strokes in lime, wordmark "Apprentice" types next to it | Logo spring (one overshoot) + **light leak** (#8) on lock | Bass hit on lock |
| 0:15 | "This is Apprentice." | Tagline: **"Show it once. Delegate forever."** word-by-word | Mask reveal, 40 ms stagger. L-cut: keyboard clicks from Act 1 tail under it (#3) | Music begins, tense pulse |

**Exit:** giant "A" mark slides across the lens → **object block** (#11) into Act 3.

### ACT 3 — The problem · 0:18–0:50

| TC | VO | Visual | Motion / transition | SFX / music |
|---|---|---|---|---|
| 0:18 | "Monday. Sixty new issues." | Queue screenshot fragments (real UI) float as glass cards in 2.5D, issue count `60` in mono top-right | **Pan** (#9) slow lateral drift, parallax 3 depth layers | Tense pulse |
| 0:23 | "Half of them say *it's broken*. No version. No steps." | Three real issue cards zoom forward: "Recurring job runs twice", "MCP connector fails to connect", "Markdown renders wrong in comments" — the missing info is struck through in `bad` | Each card cross-zooms forward one after another | Paper/UI swishes |
| 0:30 | "So Maya does the same thing every time." | Split-screen ×4 of the same steps: `+needs-info` · `+bug` · request repro · assign `triage` | 4 panels wipe in on beats | Clicks synced to beats |
| 0:36 | "Label. Ask for a repro. Assign. Next." | **Timelapse** (#13): clock 9:00 → 12:40, issue counter racing, panels repeating | 8× speed-ramp, frame blending, ramp out on beat | Ticking clock sped up, riser |
| 0:44 | "Her agent could help. If she wrote it a prompt. And trusted it." | Kinetic: **"Write a prompt?"** then **"Trust it?"** in `text-dim`, each crossed out by a `bad` line | Line draws left → right 10 frames | Two dull thuds |

**Breaker clip** (#12) 0:48–0:50: black card, **"What if it just watched?"** — music drops out on the last word.

### ACT 4 — The painkiller · 0:50–1:08

| TC | VO | Visual | Motion / transition | SFX / music |
|---|---|---|---|---|
| 0:50 | "Apprentice learns your work by watching you do it." | The scattered panels from Act 3 snap into one ordered column: Watch → Suggest → Draft → Act → Auto. Color shifts muted → lime | **Whip** (#10) in from the right; panels fly to grid positions with spring (no bounce) | Bass hit + music lifts to major |
| 0:58 | "After two similar demonstrations, it proposes a playbook. Then it has to prove it." | The five rungs become a staircase (like the Insights trust-ladder chart). One lime dot climbs to rung 1 | Dot moves on eased path, rung glows on arrival | Soft chime per rung |
| 1:04 | "Let's watch Maya teach it." | Staircase tilts back in 3D and becomes the floor under the browser frame | **Film roll-in** (#6) of the browser mockup | Whoosh, drive beat begins |

### ACT 5 — Product walkthrough · 0:42–2:15 (real app, real + demo data)

> Captured with a scripted Playwright run (`video/capture/full.mjs`) against the running app: Reset demo → **Import BuilderIO/agent-native** → triage → playbook → backtest → shadow → promote → Act → Why? → override → undo. 55 real screenshots at 2880×1620 with the click-target coordinates logged (`video/public/shots/manifest.json`); the cursor, zooms, ripples and callouts are animated from that log in Remotion.

| Scene | VO | Real UI (shot ids) | Camera / callout | In-transition |
|---|---|---|---|---|
| Import (0:42) | "These are real, open issues from the Agent-Native repo on GitHub. Apprentice imports them read-only. It never writes back." | Settings → type `BuilderIO/agent-native` → Import → toast **"Imported 30 new issue(s)"** → real issue **#8301 "Error screen: Something went wrong"** | zoom 1.7–1.9 on input / button / toast; callouts "Import open issues · read-only", "30 real issues imported", "BuilderIO/agent-native #8301 · real" | **Film roll-in** |
| Teach #31 (0:52) | "Maya triages issue thirty-one the way she always does. Needs info. Bug. Request a repro. Assign to triage." | +needs-info → +bug → Request repro dialog → assign `triage` | cursor on curves, click ripples; "Recorded as a demonstration" | **Wipe** |
| Teach #32 (1:01) | "Then thirty-two. Every click is a typed action, so each one is recorded as a demonstration." | same steps, faster | | **Jump cut** |
| Ghost #33 (1:07) | "On thirty-three, it's already predicting her next step. She just presses Tab." | ghost chip "Label +bug · Tab" → Tab ×3 | zoom 2.1 on chip, key caps `Tab` | Standard cut |
| Pattern (1:12) | "And it noticed the pattern. It even sees that her teammate Bob handles these differently, and lets the team choose. / One click turns it into a playbook she can read and edit." | pattern card + "Your team handles this two ways" → Make playbook (my way) → editor | "Pattern found · seen 2×", "Bob does it differently", "Fixed · From the issue · Agent decides" | **Cross zoom** |
| Backtest (1:23) | "Before she trusts it, it replays her history. Twenty-nine issues. Seventeen matched. Fourteen exactly how she would do them. / She loosens one condition, and the false positives jump from three to seven. So she keeps it tight." | Backtest **29 · 17 · 14 · 0 · 3** → untick "has a version" → **29 · 21 · 14 · 0 · 7** → re-tick | numbers zoom 1.9; "False positives 3 → 7" in red | **Cross zoom** |
| Shadow → Act (1:39) | "Then it runs in shadow mode. Nothing changes until she approves. / Five approvals in a row earn a promotion. Draft, then Act." | Run on untriaged → Review (shadow) → `A` ×5 → Promote to Draft → Promote to Act | key caps `A`; "5 reviewed · 100% agreed", "Trust level: Act" + **light leak** | **Whip** |
| Act + Why (1:48) | "At Act, new issues are handled on their own. Four handled, each one with an undo. / Who taught you this? It points straight to her own demonstrations, on issues thirty-one and thirty-two." | Act run **1 / 4 · 4 done** with *Undo run* → issue #64 → **Why?** → "Who taught me this?" lists #31 and #32 | "4 handled · each with undo", "Taught by her: #31, #32" | **Wipe** |
| Override (2:00) | "Now a real one from GitHub. Issue eighty-nine eighteen is a feature request, not a bug. The rule got it wrong, so Maya overrides it. / That correction becomes a regression test. And the playbook steps back to Draft, until it passes." | real **#8918** in Review → Override → "This playbook shouldn't apply here" → Save → toast **"Saved as test #3"** + **"Apprentice stepped back to Draft: override at autonomy"** → Tests 2/3 | "Real issue #8918 · a feature request", "Saved as test #3", "Stepped back to Draft", "Must pass before promotion" | **Glitch** |

### ACT 6 — Under the hood: Agent-Native · 2:22–2:45

| TC | VO | Visual | Motion / transition | SFX / music |
|---|---|---|---|---|
| 2:22 | "Here's why this works." | The browser frame pulls back; the three issues Maya touched dissolve into nodes on the grid | **Cross dissolve** (#4), 20 frames, blur midpoint; then **pan** | Music thins to wonder pad |
| 2:26 | "In Agent-Native, a button and the agent call the same typed action." | Two nodes — **UI click** and **Agent** — both send a light pulse along edges into one node: `label-issue` | Pulses travel edges, 0.6 s each, lime | Soft data ticks |
| 2:31 | "So every click is already a clean demonstration. No screen scraping." | Code card in Geist Mono (real code from `actions/label-issue.ts`): `export default defineAction({ schema: z.object({ issueId, add, remove, playbookContext }), ...domainAction("label-issue", …) })` | Lines highlight one by one, `playbookContext` lit in lime | Key-tick per line |
| 2:37 | "And the trust ladder is the framework's own approval gate." | Second code card (real code from `server/apprentice/services/approval.ts`): `if (pb.trustLevel <= LEVELS.DRAFT) return true;` / `if (pb.trustLevel === LEVELS.ACT) return !!step?.checkpoint \|\| destructive;` → `needsApproval` | Edge from playbook node passes through a "gate" node that opens (lime) at Act | Gate "clunk" |
| 2:42 | *(on-screen line)* | **"62 typed actions. One for the UI and the agent."** + small mono "55 tests passing" | Counter up; numbers are real (`actions/` count, `pnpm test`) | Hit |

**Exit:** the `label-issue` node scales up to fill the frame → **object block** (#11) into Act 7.

### ACT 7 — Impact · 2:45–3:03

| TC | VO | Visual | Motion / transition | SFX / music |
|---|---|---|---|---|
| 2:45 | "Back to Maya's Monday." | Real **Insights** dashboard: area chart (minutes saved), decisions donut, agreement line crossing the 80% and 90% gates, trust-ladder staircase | Slow **pan** across; charts draw in (they animate in the app) | Triumphant drive |
| 2:50 | "Autopilot handles the repeats and sends her a digest. She only sees the ones that need her." | **Timelapse** (#13) of *Run autopilot* → digest; then "Why items still need you" bars | Speed-ramp in and out | Fast ticks → resolve |
| 2:56 | *(VO continues)* "Every learned playbook exports as a SKILL file any agent can use." | **Before/After wipe** (#5): left "Before: 4 clicks × every issue" (`bad` tint) / right "After: review the exceptions" (lime) | Vertical wipe with lime edge | Whoosh |
| 3:00 | — | Three benefit chips: **"Learns from your clicks" · "Proves it first" · "Undo in one click"** | Chips pop in 6-frame stagger | Three light ticks |

Use only numbers visible in your recorded Insights screen; don't invent a "hours saved" figure.

### ACT 8 — Outro / CTA · 3:03–3:15

| TC | VO | Visual | Motion / transition | SFX / music |
|---|---|---|---|---|
| 3:03 | *(Breaker #12)* | **"Show it once."** on black | Word reveal on the downbeat | Music drops |
| 3:05 | "Maya closes her laptop before lunch." | Return to the Act 1 framing: the same issue, now handled, a lime ✓ next to it | **Cross dissolve** (#4) | Warm pad |
| 3:08 | "Apprentice. Show it once. Delegate forever." | End card: logo + tagline, orb, grid. Links in mono: `apprentice-agent.onrender.com` · `github.com/LSUDOKO/Apprentice`. "Built with **Agent-Native** for the Builder.io Agent-Native Hackathon". Your name. | Logo springs in, light leak sweep, everything else fades up 12 frames apart | Final bass hit, music resolves, 1 s tail |

---

## 4. Full VO script (as recorded)

> Generated with **Kokoro v1.0** (open-source TTS, voice `af_heart`, speed 0.95), one file per line in `video/public/vo/`. Lines are placed by `video/src/plan.json`; picture is timed to them.

| id | line |
|---|---|
| h1 | Maya has clicked this exact sequence a hundred times. |
| h2 | Today, it'll be a hundred and one. |
| t1 | This is Apprentice. |
| p1 | Maya maintains an open-source project. Every morning brings a fresh pile of issues. |
| p2 | Half of them just say: it's broken. No version. No steps. |
| p3 | So she does the same thing, every single time. Label it. Ask for a repro. Assign it. Next. |
| p4 | An agent could help. If she wrote it a prompt. And trusted it. |
| s1 | Apprentice learns the job by watching her do it. Then it has to prove it, before it's trusted to act. |
| w1 | These are real, open issues from the Agent-Native repo on GitHub. Apprentice imports them read-only. It never writes back. |
| w2 | Maya triages issue thirty-one the way she always does. Needs info. Bug. Request a repro. Assign to triage. |
| w3 | Then thirty-two. Every click is a typed action, so each one is recorded as a demonstration. |
| w4 | On thirty-three, it's already predicting her next step. She just presses Tab. |
| w5 | And it noticed the pattern. It even sees that her teammate Bob handles these differently, and lets the team choose. |
| w6 | One click turns it into a playbook she can read and edit. |
| w7 | Before she trusts it, it replays her history. Twenty-nine issues. Seventeen matched. Fourteen exactly how she would do them. |
| w8 | She loosens one condition, and the false positives jump from three to seven. So she keeps it tight. |
| w9 | Then it runs in shadow mode. Nothing changes until she approves. |
| w10 | Five approvals in a row earn a promotion. Draft, then Act. |
| w11 | At Act, new issues are handled on their own. Four handled, each one with an undo. |
| w12 | Who taught you this? It points straight to her own demonstrations, on issues thirty-one and thirty-two. |
| w13 | Now a real one from GitHub. Issue eighty-nine eighteen is a feature request, not a bug. The rule got it wrong, so Maya overrides it. |
| w14 | That correction becomes a regression test. And the playbook steps back to Draft, until it passes. |
| u1 | Here's why this works. |
| u2 | In Agent-Native, a button click and an agent call the exact same typed action. |
| u3 | So every click is already a clean demonstration. No screen scraping. |
| u4 | And the trust ladder is the framework's own approval gate. |
| i1 | Back to Maya's morning. |
| i2 | Apprentice handles the repeats, and shows her only what needs her. |
| i3 | And every playbook exports as a skill file, that any agent can use. |
| o1 | Maya closes her laptop before lunch. |
| o2 | Apprentice. Show it once. Delegate forever. |

## 5. Sound design & music

- **Music:** original score generated in code (`video/capture/music.py`, numpy synthesis, 96 BPM): drone (hook) → minor pulse (problem) → major lift (turn) → drive with kick/bass/arp (walkthrough) → airy pads (under the hood) → full (impact) → resolving pad (outro). No third-party audio, so no license to clear. SFX are also synthesized (`video/capture/sfx.py`).
- **SFX layer:** key clicks (Acts 1, 3, 5), whooshes on whips and object blocks, sub-bass hits on "Again.", the logo lock, the painkiller turn and the end card, risers before title and Act, glitch burst on the override, soft chime on "Saved as test" and each trust rung, ticking clock in timelapses.
- **Mix:** music ducked −15 dB under VO (sidechain), VO de-essed + light compression, final **−14 LUFS integrated, true peak ≤ −1 dBTP**.

## 6. Captions

- Word-timed from the final VO with faster-whisper, proofread (Apprentice, Agent-Native, SKILL, repro).
- Export `apprentice-film.srt`. Burned version: Geist 500 44 px, `text` on a 60% `bg` pill, 2 lines max, bottom-center above the 96 px margin, **active word in lime**.

## 7. Production plan (toolchain)

1. **Record** (Playwright, 2560×1440 @ 60 fps, dark theme, cursor hidden): one script per Act 5 row, with an action log `{t, x, y, type, label}` → `docs/video/actions.json`. Cut all loading (Render cold start, skeletons).
2. **VO:** Chatterbox (`~/.local/share/chatterbox/.venv`), test 2–3 voices, pick the most natural, fix pronunciations, loudnorm.
3. **Composition:** Remotion project in `video/` — one composition per Act, brand tokens as a TS constants file, Geist via `@remotion/google-fonts`, recordings as `<OffthreadVideo>`, cursor/zoom layer driven by `actions.json`.
4. **Under the hood graph:** SVG nodes/edges in Remotion, pulses via `strokeDashoffset`, code cards with real file excerpts.
5. **Music + SFX + mix** with FFmpeg (`sidechaincompress`, `loudnorm`).
6. **Captions** with `whisper-ctranslate2`, burned in Remotion.
7. **Render** 1080p60 H.264 High, 16 Mbps, AAC 320 kbps 48 kHz; thumbnail 1280×720 from the title frame.
8. **Upload** to clips.agent-native.com → Public → test in a private window → submit form → confirm receipt.

## 8. Deliverables

- `apprentice-film.mp4` (1080p60), `apprentice-film-captioned.mp4`, `apprentice-film.srt`
- `thumbnail.png` 1280×720 (brand title frame)
- Optional 45–60 s social cut: Acts 1, 2, 5 (ghost chip → backtest → override → Act), 8
- Remotion source in `video/` so any shot re-renders

## 9. Quality checklist

- [ ] Hook in the first 3 s; a stranger understands the problem by 0:30
- [ ] Maya from the first frame to the last; ending returns to the opening frame, resolved
- [ ] Every walkthrough shot is the real app; "demo data" label visible
- [ ] Every number on screen read from the app or the repo (backtest, tests, actions, Insights)
- [ ] Cursor always on curves with overshoot; every click has ripple + sound
- [ ] Agent-Native shown as essential: same typed action for UI and agent, `needsApproval` gate, real code
- [ ] Only brand colors and Geist / Geist Mono; lime used only for answers and actions
- [ ] Headlines ≤ 6 words; every text holds long enough to read
- [ ] 60 fps, motion blur on fast moves, no jitter; each of the 13 transitions has a reason
- [ ] VO natural, names pronounced right; −14 LUFS; voice clear over music
- [ ] Runtime 3:00–3:30; watched once muted (captions carry it) and once eyes closed (VO carries it)
- [ ] Clips link public, opens without login; form submitted before 11:59 PM PT and receipt confirmed
