import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

const REPO = "https://github.com/LSUDOKO/Apprentice";
const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=<>/\\[]{}$@";

function randomGlyph(): string {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "#";
}

/** Matrix-style glyph field that slowly mutates, like the Pretech poster. */
function GlyphField({ cols = 14, rows = 20 }: { cols?: number; rows?: number }) {
  const reduce = useReducedMotion();
  const [cells, setCells] = useState<string[]>(() => Array.from({ length: cols * rows }, (_, i) => (i % 3 === 0 ? " " : randomGlyph())));
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setCells((prev) => {
        const next = [...prev];
        for (let k = 0; k < 10; k++) {
          const i = Math.floor(Math.random() * next.length);
          next[i] = Math.random() < 0.3 ? " " : randomGlyph();
        }
        return next;
      });
    }, 140);
    return () => window.clearInterval(id);
  }, [reduce]);
  return (
    <div className="glyphs" aria-hidden>
      {cells.map((c, i) => (
        <span key={i}>{c}</span>
      ))}
    </div>
  );
}

/** Text that resolves from random glyphs into its real value — a click becoming a typed action. */
function Decode({ text, active }: { text: string; active: boolean }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(active && reduce ? text : text.replace(/\S/g, " "));
  useEffect(() => {
    if (!active) {
      setShown(text.replace(/\S/g, " "));
      return;
    }
    if (reduce) {
      setShown(text);
      return;
    }
    let frame = 0;
    const total = 16;
    const id = window.setInterval(() => {
      frame++;
      const settled = Math.floor((frame / total) * text.length);
      setShown(
        text
          .split("")
          .map((ch, i) => (i < settled || ch === " " ? ch : randomGlyph()))
          .join(""),
      );
      if (frame >= total) window.clearInterval(id);
    }, 28);
    return () => window.clearInterval(id);
  }, [active, text, reduce]);
  return <span>{shown}</span>;
}

function Crosses() {
  const points = [
    [12, 22],
    [37, 22],
    [62, 22],
    [87, 22],
    [12, 58],
    [87, 58],
  ];
  return (
    <>
      {points.map(([x, y]) => (
        <span key={`${x}-${y}`} className="cross" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden />
      ))}
    </>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className="nav" data-scrolled={scrolled}>
      <div className="wrap nav-inner">
        <a className="brand" href="#top" aria-label="Apprentice home">
          <img src="/mark.svg" width={26} height={26} alt="" />
          Apprentice<sup>™</sup>
        </a>
        <nav className="nav-links" aria-label="Sections">
          <a href="#learn">How it learns</a>
          <a href="#trust">Trust ladder</a>
          <a href="#proof">Proof</a>
          <a href="#agent-native">Agent-Native</a>
        </nav>
        <a className="btn btn-ghost" href={REPO}>
          View on GitHub
        </a>
      </div>
    </header>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const orbY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "-18%"]);
  const orbScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.15]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120]);
  const letters = "Apprentice".split("");
  return (
    <section className="hero" id="top" ref={ref}>
      <div className="gridlines" aria-hidden />
      <Crosses />
      <motion.div
        className="orb"
        aria-hidden
        style={{ y: orbY, scale: orbScale }}
        initial={reduce ? false : { opacity: 0, translateY: 260 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
      />
      <GlyphField />
      <motion.div className="wrap hero-copy" style={{ y: copyY }}>
        <h1 className="wordmark" aria-label="Apprentice">
          {letters.map((l, i) => (
            <motion.span
              key={i}
              aria-hidden
              initial={reduce ? false : { opacity: 0, y: 40, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.25 + i * 0.045, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              {l}
            </motion.span>
          ))}
          <sup aria-hidden>™</sup>
        </h1>
        <motion.p
          className="lede"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.8 }}
        >
          The agent that learns your job by watching you do it. <span>It proves what it learned, then earns the right to do it for you.</span>
        </motion.p>
        <motion.div className="hero-cta" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.8 }}>
          <a className="btn btn-halo" href="#learn">
            See how it learns
          </a>
          <a className="btn" href={REPO}>
            Read the code
          </a>
        </motion.div>
      </motion.div>
      <div className="strip">
        <div className="wrap strip-inner micro">
          <span>Watches your clicks</span>
          <span>Proves with tests</span>
          <span>Earns autonomy</span>
          <span>Built on Agent-Native</span>
        </div>
      </div>
    </section>
  );
}

type Demo = { who: string; issue: string; text: string; key: string };

const DEMOS: Demo[] = [
  { who: "#31", issue: "Recurring job runs twice", key: "label-issue", text: " add bug, needs-info" },
  { who: "", issue: "", key: "request-repro", text: " missing version, steps" },
  { who: "", issue: "", key: "assign-issue", text: " triage" },
  { who: "#32", issue: "MCP connector fails to connect", key: "label-issue", text: " add bug, needs-info" },
  { who: "", issue: "", key: "request-repro", text: " missing version, steps" },
  { who: "", issue: "", key: "assign-issue", text: " triage" },
];

function useStage(progress: MotionValue<number>, stages: number): number {
  const [stage, setStage] = useState(0);
  useMotionValueEvent(progress, "change", (v) => setStage(Math.min(stages, Math.floor(v * (stages + 1)))));
  return stage;
}

/** The signature moment: scroll through two demonstrations and watch them become a playbook. */
function Learn() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const stage = useStage(scrollYProgress, DEMOS.length + 1);
  const showPlaybook = stage > DEMOS.length;
  return (
    <section className="decode" id="learn" ref={ref} aria-label="How Apprentice learns">
      <div className="decode-stick">
        <div className="wrap decode-grid">
          <div>
            <h2 className="h2">Every click is already a lesson.</h2>
            <p className="body" style={{ marginTop: 24 }}>
              In Agent-Native, the buttons you press and the agent's tools are <strong>the same typed actions</strong>. So when you triage an issue by hand,
              Apprentice records a clean demonstration. No screen recording. No prompt to write.
            </p>
            <p className="body">After two issues handled the same way, it proposes a playbook, with every value marked as fixed, copied from the issue, or left for the agent to write.</p>
            <div className="progress-dots" aria-hidden>
              {Array.from({ length: DEMOS.length + 2 }, (_, i) => (
                <span key={i} style={{ background: i <= stage ? "var(--halo)" : undefined }} />
              ))}
            </div>
          </div>
          <div className="console" role="img" aria-label="Two demonstrations recorded, then turned into the playbook 'Needs-info for unversioned bugs'">
            <div className="console-head micro">
              <span>Watching · demonstrations</span>
              <span>{Math.min(stage, DEMOS.length)} / 6 steps</span>
            </div>
            {DEMOS.map((d, i) => (
              <motion.div key={i} className="demo-row" initial={false} animate={{ opacity: stage > i ? 1 : 0.15 }} transition={{ duration: 0.3 }}>
                <span className="who">{d.who}</span>
                <span className="act">
                  {d.issue ? <span style={{ color: "var(--fog)", display: "block", fontFamily: "var(--sans)" }}>{d.issue}</span> : null}
                  <span className="k">
                    <Decode text={d.key} active={stage > i} />
                  </span>
                  <Decode text={d.text} active={stage > i} />
                </span>
              </motion.div>
            ))}
            <motion.div
              className="playbook"
              initial={false}
              animate={showPlaybook ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="micro" style={{ color: "var(--halo)" }}>
                I noticed a pattern
              </span>
              <h3>Needs-info for unversioned bugs</h3>
              <span style={{ color: "var(--fog)" }}>when kind is bug · no version mentioned</span>
              <div className="chips">
                <span className="chip fixed">◆ add bug, needs-info</span>
                <span className="chip fixed">◆ missing version, steps</span>
                <span className="chip agent">✦ message: agent writes it</span>
                <span className="chip fixed">◆ assign triage</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

const RUNGS = [
  { name: "Watch", text: "Only learns from what you do." },
  { name: "Suggest", text: "Proposes decisions in shadow mode. Nothing changes until you review." },
  { name: "Draft", text: "Prepares each change and waits for your Approve." },
  { name: "Act", text: "Does the safe steps itself, with one-click undo. Risky ones still ask." },
  { name: "Auto", text: "Handles the whole pattern. One override and it steps back down." },
];

function Rung({ i, progress, name, text }: { i: number; progress: MotionValue<number>; name: string; text: string }) {
  const fill = useTransform(progress, [i / 5, (i + 1) / 5], [0, 1]);
  return (
    <article className="rung">
      <motion.div className="rung-fill" style={{ scaleY: fill }} aria-hidden />
      <span className="num">{i}</span>
      <h3>{name}</h3>
      <p>{text}</p>
    </article>
  );
}

function Trust() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] });
  return (
    <section className="section" id="trust">
      <div className="wrap">
        <h2 className="h2">Autonomy is earned, one rung at a time.</h2>
        <p className="body" style={{ marginTop: 24 }}>
          Every promotion needs evidence (enough reviewed decisions, high agreement, every regression test passing) <strong>and your click</strong>. The
          ladder is built on the framework's own approval gate, so a paused step is a real pause.
        </p>
        <div className="ladder" ref={ref}>
          {RUNGS.map((r, i) => (
            <Rung key={r.name} i={i} progress={scrollYProgress} name={r.name} text={r.text} />
          ))}
        </div>
      </div>
    </section>
  );
}

const BACKTEST = [
  { label: "Considered", value: 30 },
  { label: "Matched", value: 18 },
  { label: "Agreed", value: 15 },
  { label: "Disagreed", value: 3 },
];

function Proof() {
  const reduce = useReducedMotion();
  return (
    <section className="section hair" id="proof">
      <div className="wrap proof-grid">
        <div>
          <h2 className="h2">Proof before trust.</h2>
          <p className="body" style={{ marginTop: 24 }}>
            Before a playbook touches a real issue, Apprentice replays it against the issues you already triaged and shows exactly where it would have
            disagreed with you.
          </p>
          <div className="backtest" aria-label="Backtest of the demo playbook">
            {BACKTEST.map((b) => (
              <div className="backtest-row" key={b.label}>
                <span>{b.label}</span>
                <div className="bar">
                  <motion.div
                    initial={reduce ? false : { scaleX: 0 }}
                    whileInView={{ scaleX: b.value / 30 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                    style={reduce ? { transform: `scaleX(${b.value / 30})` } : undefined}
                  />
                </div>
                <span style={{ color: "var(--bone)", textAlign: "right" }}>{b.value}</span>
              </div>
            ))}
          </div>
          <p className="body" style={{ marginTop: 32 }}>
            <strong>Your corrections become tests.</strong> Override a decision and it is saved as a regression test. The playbook can't be promoted, and an edit
            can't be saved, while it would repeat the mistake.
          </p>
        </div>
        <div style={{ display: "grid", gap: 20 }}>
          <figure className="frame" style={{ margin: 0 }}>
            <img src="/screens/03-backtest.png" alt="Backtest tab: 30 considered, 18 matched, 15 agreed, with the disagreements listed" loading="lazy" />
            <figcaption>Toggle a condition and the backtest reruns live.</figcaption>
          </figure>
          <figure className="frame" style={{ margin: 0 }}>
            <img src="/screens/05-tests.png" alt="Tests tab: test #3 from an override is failing and blocks promotion" loading="lazy" />
            <figcaption>An override became test #3. It fails until the recipe is fixed.</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

const LOOP = [
  { title: "Ghost suggestions", text: "On the third similar issue, your next step appears as a faint chip. Press Tab and it runs through the same action the button uses." },
  { title: "A recipe you can read", text: "Trigger, steps and checkpoints, with every value marked fixed, copied from the issue, or written by the agent. Every save is a version." },
  { title: "Shadow review", text: "Approve, edit, override or skip from the keyboard. The agreement meter tracks how often it thought like you." },
  { title: "Who taught you this?", text: "Every automatic change links back to the playbook version, the conditions that matched, and your original demonstrations." },
  { title: "Undo the whole batch", text: "Each step stores a before-snapshot. Undo restores every issue and retracts comments, without overwriting newer human work." },
  { title: "Team disagreements", text: "When two teammates handle the same kind of issue differently, Apprentice shows both ways and asks the team to pick one." },
];

function Loop() {
  return (
    <section className="section hair">
      <div className="wrap">
        <h2 className="h2">Built to be trusted with real work.</h2>
        <div className="loop">
          {LOOP.map((l) => (
            <article key={l.title}>
              <h3>{l.title}</h3>
              <p>{l.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Screens() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const a = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 60, reduce ? 0 : -60]);
  const b = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 120, reduce ? 0 : -40]);
  const shots = useMemo(
    () => [
      { src: "/screens/01-pattern-card.png", alt: "Pattern card in the queue", cap: "Two demonstrations in, the pattern card appears.", span: "1 / span 7", y: a },
      { src: "/screens/04-review.png", alt: "Review split view", cap: "Shadow review: what it would do, and why.", span: "8 / span 5", y: b },
      { src: "/screens/07-provenance.png", alt: "Provenance drawer", cap: "Provenance names the demonstrations it learned from.", span: "1 / span 5", y: b },
      { src: "/screens/08-insights.png", alt: "Insights page", cap: "Estimated time saved, agreement and autonomy.", span: "6 / span 7", y: a },
    ],
    [a, b],
  );
  return (
    <section className="section hair">
      <div className="wrap">
        <h2 className="h2">The workspace.</h2>
        <p className="body" style={{ marginTop: 24 }}>
          A triage queue, a playbook editor, a review screen and an insights ledger, with the agent beside you in every one.
        </p>
        <div className="screens" ref={ref}>
          {shots.map((s) => (
            <motion.figure key={s.src} className="frame" style={{ gridColumn: s.span, margin: 0, y: s.y }}>
              <img src={s.src} alt={s.alt} loading="lazy" />
              <figcaption>{s.cap}</figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

const MAP: [string, string][] = [
  ["Demonstrations", "Every triage operation is a <code>defineAction</code>. Human calls from the UI are recorded as steps, backed by the framework audit log."],
  ["The trust ladder", "A <code>needsApproval</code> predicate on every domain action gates playbook executions by trust level and checkpoints."],
  ["Context", "<code>view-screen</code> and <code>navigation</code>/<code>selection</code> app state tell the agent what you're looking at; <code>focus-issue</code> moves your screen."],
  ["Lessons", "The framework Recorder timeline merges with your typed or dictated narration."],
  ["Autopilot", "A scheduled automation in Agent Resources runs playbooks and posts a digest, to Slack when Messaging is connected."],
  ["Outside agents", "Featured MCP tools, and <code>embedRoute</code> renders the real review screen inline in Claude and ChatGPT."],
  ["Portable skills", "Each playbook exports as a standard <code>SKILL.md</code> plus <code>playbook.json</code>."],
];

function AgentNative() {
  return (
    <section className="section hair" id="agent-native">
      <div className="wrap">
        <h2 className="h2">Only possible on Agent-Native.</h2>
        <p className="body" style={{ marginTop: 24 }}>
          Because the UI and the agent share one set of typed actions, your normal work is already machine-readable. Apprentice is built entirely on the
          framework's own pieces.
        </p>
        <dl className="map">
          {MAP.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd dangerouslySetInnerHTML={{ __html: v }} />
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Finale() {
  return (
    <section className="finale hair">
      <div className="gridlines" aria-hidden />
      <div className="wrap">
        <h2 className="h2" style={{ maxWidth: "12ch" }}>
          Show it once. Delegate forever.
        </h2>
        <div className="hero-cta">
          <a className="btn btn-halo" href={REPO}>
            Get the code on GitHub
          </a>
          <a className="btn" href={`${REPO}#run-it-locally`}>
            Run it locally
          </a>
        </div>
      </div>
      <div className="orb" aria-hidden />
      <footer className="footer strip">
        <div className="wrap strip-inner micro">
          <span>Apprentice</span>
          <span>Builder.io Agent-Native Hackathon</span>
          <span>Demo data is invented</span>
          <span>MIT licensed</span>
        </div>
      </footer>
    </section>
  );
}

export default function App() {
  return (
    <>
      <div className="grain" aria-hidden />
      <Nav />
      <main>
        <Hero />
        <Learn />
        <Trust />
        <Proof />
        <Loop />
        <Screens />
        <AgentNative />
        <Finale />
      </main>
    </>
  );
}
