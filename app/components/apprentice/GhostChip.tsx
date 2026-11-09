import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { actionErrorMessage, callAction, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { IconSparkles } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { isTypingTarget } from "./WorkspaceChrome";

type Suggestion = {
  sourceId: string;
  sourceKind: "playbook" | "candidate";
  playbookName: string;
  stepIndex: number;
  stepCount: number;
  action: string;
  args: Record<string, unknown>;
  label: string;
  needsAgent: boolean;
  agentParams: string[];
};

/**
 * Ghost autocomplete (F9): a faint chip predicting the user's next step.
 * Tab runs it through the same action the buttons use; Esc dismisses.
 */
export function GhostChip({ issueId, onAccepted }: { issueId: string; onAccepted?: () => void }) {
  const { data } = useActionQuery("predict-next-step", { issueId });
  const s = (data?.suggestion ?? null) as Suggestion | null;
  const [hidden, setHidden] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const key = s ? `${s.sourceId}:${s.stepIndex}:${s.label}` : null;
  const outcome = useActionMutation("record-suggestion-outcome", { skipActionQueryInvalidation: true });
  const qc = useQueryClient();
  const chipRef = useRef<HTMLButtonElement>(null);

  async function accept() {
    if (!s) return;
    outcome.mutate({ issueId, sourceId: s.sourceId, stepIndex: s.stepIndex, action: s.action, outcome: "accepted" });
    if (s.needsAgent) {
      sendToAgentChat({
        message: `Do the next step for issue ${issueId}: ${s.label}. Write the ${s.agentParams.join(", ")} yourself.`,
        context: `Ghost suggestion from "${s.playbookName}" (step ${s.stepIndex + 1}/${s.stepCount}). Action ${s.action} with ${JSON.stringify(s.args)}. This is ad-hoc: no playbookContext.`,
        submit: true,
        openSidebar: true,
      });
      return;
    }
    setFlash(true);
    try {
      await callAction(s.action as never, { issueId, ...s.args, suggestion: { sourceId: s.sourceId, stepIndex: s.stepIndex } } as never);
      await qc.invalidateQueries({ queryKey: ["action"] });
      onAccepted?.();
    } catch (e) {
      toast.error(actionErrorMessage(e) ?? "Couldn't run the suggestion.");
    } finally {
      window.setTimeout(() => setFlash(false), 400);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!s || hidden === key || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const focus = document.activeElement;
      // Tab accepts only when focus isn't in normal tab order elsewhere: page body, the chip, or the triage controls.
      const onPage = !focus || focus === document.body || focus === chipRef.current || !!focus.closest("[data-triage]");
      if (e.key === "Tab" && !e.shiftKey && onPage) {
        e.preventDefault();
        void accept();
      } else if (e.key === "Escape") {
        setHidden(key);
        outcome.mutate({ issueId, sourceId: s.sourceId, stepIndex: s.stepIndex, action: s.action, outcome: "dismissed" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!s || hidden === key) return null;
  return (
    <button
      ref={chipRef}
      type="button"
      onClick={() => void accept()}
      className={cn(
        "ap-fade-in group flex min-w-0 max-w-sm flex-col items-start rounded-md border border-dashed px-2.5 py-1 text-start transition-colors focus-visible:outline-2 focus-visible:outline-ring",
        flash ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-foreground",
      )}
      aria-label={`Suggested next step: ${s.label}. Press Tab to accept, Escape to dismiss.`}
    >
      <span className="truncate font-mono text-[10px] opacity-80">
        {s.playbookName} · step {s.stepIndex + 1}/{s.stepCount}
        {s.sourceKind === "candidate" ? " · noticed pattern" : ""}
      </span>
      <span className="flex w-full items-center gap-2 text-[13px]">
        {s.needsAgent ? <IconSparkles className="size-3.5 text-param-agent" aria-hidden /> : null}
        <span className="truncate">{s.needsAgent ? `Ask Apprentice: ${s.label}` : s.label}</span>
        <kbd className="ms-auto rounded border border-current/30 px-1 font-mono text-[10px]">Tab ↹</kbd>
      </span>
    </button>
  );
}
