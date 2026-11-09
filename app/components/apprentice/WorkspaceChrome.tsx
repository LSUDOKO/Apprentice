import { actionErrorMessage, useActionMutation } from "@agent-native/core/client/hooks";
import { recorder } from "@agent-native/core/client/recorder";
import { IconEye, IconEyeOff, IconMicrophone, IconPlayerStop, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useWorkspaceStatus } from "./ApprenticeNav";
import { DemoBadge } from "./primitives";

/** Top bar status: "Watching ● 3 today" (click to pause) + demo badge. */
export function StatusPills() {
  const { data } = useWorkspaceStatus();
  const toggle = useActionMutation("set-watch-mode", {
    onSuccess: (r) => toast.success(r.watchMode ? "Watching again — your triage is recorded as demonstrations." : "Watching paused."),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't change watch mode."),
  });
  if (!data) return null;
  return (
    <div className="hidden items-center gap-2 md:flex">
      <button
        type="button"
        onClick={() => toggle.mutate({ on: !data.watchMode })}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring",
          data.watchMode ? "border-border bg-card text-foreground" : "border-dashed border-border text-muted-foreground",
        )}
        title={data.watchMode ? "Apprentice is learning from your triage. Click to pause." : "Watching is paused. Click to resume."}
      >
        {data.watchMode ? <IconEye className="size-3.5 text-primary" aria-hidden /> : <IconEyeOff className="size-3.5" aria-hidden />}
        {data.watchMode ? "Watching" : "Paused"}
        {data.watchMode ? (
          <span className="tabular text-muted-foreground">
            <span className="me-1 inline-block size-1.5 rounded-full bg-primary align-middle" aria-hidden />
            {data.demonstrationsToday} today
          </span>
        ) : null}
      </button>
      {data.demoMode && data.hasIssues ? <DemoBadge /> : null}
    </div>
  );
}

type SpeechRecognitionLike = { start(): void; stop(): void; continuous: boolean; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null };

function speechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Pinned while a lesson records: timer, narration (typed or dictated), Stop. */
function LessonBar({ lesson }: { lesson: { id: string; startedAt: number } }) {
  const [now, setNow] = useState(Date.now());
  const [narration, setNarration] = useState("");
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const [canDictate, setCanDictate] = useState(false);
  useEffect(() => {
    setCanDictate(!!speechRecognition());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const finish = useActionMutation("finish-lesson", {
    onSuccess: (r) =>
      toast.success(r.status === "cancelled" ? "Lesson discarded." : `Lesson saved: ${r.demonstrations} demonstration${r.demonstrations === 1 ? "" : "s"} captured.`),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't finish the lesson."),
  });
  function stop(cancel = false) {
    recognition.current?.stop();
    recorder.log("apprentice.lesson.stop", { lessonId: lesson.id });
    const seconds = Math.min(600, Math.ceil((Date.now() - lesson.startedAt) / 1000) + 2);
    const report = recorder.report({ seconds, reason: "manual" });
    finish.mutate({ lessonId: lesson.id, recorderReport: report, narration, cancel });
  }
  function dictate() {
    const Ctor = speechRecognition();
    if (!Ctor) return;
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const text = last?.[0]?.transcript ?? "";
      setNarration((n) => `${n} ${text}`.trim());
    };
    r.onend = () => setListening(false);
    recognition.current = r;
    r.start();
    setListening(true);
  }
  const secs = Math.max(0, Math.floor((now - lesson.startedAt) / 1000));
  return (
    <div className="ap-slide-in flex flex-wrap items-center gap-2 border-b border-bad/30 bg-bad/5 px-4 py-2 text-sm">
      <span className="inline-flex items-center gap-2 font-medium text-bad">
        <span className="size-2 animate-pulse rounded-full bg-bad motion-reduce:animate-none" aria-hidden /> Recording lesson
      </span>
      <span className="tabular font-mono text-xs text-muted-foreground">
        {String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}
      </span>
      <label className="sr-only" htmlFor="lesson-narration">
        Narration
      </label>
      <Input
        id="lesson-narration"
        value={narration}
        onChange={(e) => setNarration(e.target.value)}
        placeholder="Narrate why you're doing this (optional)…"
        className="h-8 min-w-48 flex-1 bg-card"
      />
      {canDictate ? (
        <Button size="sm" variant={listening ? "default" : "outline"} onClick={dictate} aria-pressed={listening}>
          <IconMicrophone className="size-3.5" /> {listening ? "Listening…" : "Dictate"}
        </Button>
      ) : null}
      <Button size="sm" onClick={() => stop(false)} disabled={finish.isPending}>
        <IconPlayerStop className="size-3.5" /> Stop & save
      </Button>
      <Button size="sm" variant="ghost" onClick={() => stop(true)} disabled={finish.isPending} aria-label="Discard lesson">
        <IconX className="size-3.5" />
      </Button>
    </div>
  );
}

/** Banners that belong above every Apprentice page: lesson recording, drift demotion, empty workspace. */
export function WorkspaceBanners() {
  const { data } = useWorkspaceStatus();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const seed = useActionMutation("seed-demo-data", {
    onSuccess: () => toast.success("Demo data loaded: 60 issues and past demonstrations."),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't load demo data."),
  });
  if (!data) return null;
  const demotion = data.demotions[0];
  return (
    <>
      {data.lesson ? <LessonBar lesson={data.lesson} /> : null}
      {demotion && dismissed !== `${demotion.playbookId}:${demotion.at}` ? (
        <div role="status" className="ap-slide-in flex items-center gap-3 border-b border-warn/30 bg-warn/10 px-4 py-2 text-sm">
          <span className="font-medium text-warn">Apprentice stepped back</span>
          <span className="min-w-0 flex-1 truncate">
            on <Link className="underline" to={`/playbooks/${demotion.playbookId}?tab=history`}>{demotion.name}</Link>: {demotion.reason.replace(/^Apprentice stepped back: /, "")}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(`${demotion.playbookId}:${demotion.at}`)} aria-label="Dismiss">
            <IconX className="size-3.5" />
          </Button>
        </div>
      ) : null}
      {!data.hasIssues && !pathname.startsWith("/preferences") ? (
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2 text-sm">
          <span className="flex-1">Your queue is empty. Load the demo dataset (60 invented issues) or import a GitHub repo in Settings.</span>
          <Button size="sm" onClick={() => seed.mutate({})} disabled={seed.isPending}>
            {seed.isPending ? "Loading…" : "Load demo data"}
          </Button>
        </div>
      ) : null}
    </>
  );
}

const SHORTCUTS: [string, string][] = [
  ["j / k", "Move down / up in lists"],
  ["Enter", "Open the selected item"],
  ["Tab", "Accept the ghost suggestion"],
  ["Esc", "Dismiss the suggestion / close"],
  ["l", "Focus the label editor"],
  ["p", "Focus priority"],
  ["r", "Request repro"],
  ["a · e · o · s", "Approve · Edit · Override · Skip (review)"],
  ["g q / g r / g e / g p / g i / g l / g s", "Go to Queue / Review / Exceptions / Playbooks / Insights / Lessons / Settings"],
  ["?", "Show this help"],
  ["⌘K", "Command menu"],
  ["⌘I", "Send selection to the agent"],
];

const GO: Record<string, string> = { q: "/issues", r: "/review", e: "/exceptions", p: "/playbooks", i: "/insights", l: "/lessons", s: "/preferences" };

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || !!el.closest("[data-agent-chat], .agentkit-composer-stack, [role='dialog']");
}

/** Global keyboard map: `g` + letter navigation and the `?` overlay. */
export function GlobalShortcuts() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pendingG = useRef<number | null>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (pendingG.current && GO[e.key]) {
        e.preventDefault();
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        navigate(GO[e.key] ?? "/issues");
        return;
      }
      if (e.key === "g") {
        pendingG.current = window.setTimeout(() => (pendingG.current = null), 900);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Apprentice is keyboard-first. Shortcuts are off while you type.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-xs">
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">{k}</kbd>
              </dt>
              <dd className="text-muted-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
