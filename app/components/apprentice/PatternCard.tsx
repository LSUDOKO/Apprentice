import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { actionErrorMessage, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { IconSparkles, IconUsers, IconX } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { InlineMd, SpecSteps } from "./Steps";

/** "I noticed a pattern…" — the moment Apprentice turns demonstrations into a proposal (F2, F19). */
export function PatternCards() {
  const { data } = useActionQuery("list-pattern-candidates", {});
  const navigate = useNavigate();
  const create = useActionMutation("create-playbook", {
    onSuccess: (r) => {
      toast.success(`Playbook created: ${r.name}`);
      navigate(r.path);
    },
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't create the playbook."),
  });
  const resolve = useActionMutation("resolve-conflict", {
    onSuccess: (r) => {
      toast.success(`Team decision recorded: ${r.name}`);
      navigate(r.path);
    },
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't resolve the conflict."),
  });
  const dismiss = useActionMutation("dismiss-pattern", { onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't dismiss.") });
  const candidates = data?.candidates ?? [];
  if (!candidates.length) return null;
  return (
    <div className="space-y-2">
      {candidates.map((c) => {
        const other = c.conflictWith?.[0];
        return (
          <section key={c.id} aria-label="Pattern noticed" className="ap-slide-in rounded-[10px] border border-primary/40 bg-card p-3 shadow-[0_1px_0_hsl(var(--border))]">
            <div className="flex items-start gap-2">
              <IconSparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">I noticed a pattern</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  When <span className="text-foreground">
                    <InlineMd text={c.triggerText} />
                  </span>, you did these steps — seen {c.support}× today.
                </p>
              </div>
              <Button size="icon" variant="ghost" className="size-7" aria-label="Dismiss pattern" onClick={() => dismiss.mutate({ candidateId: c.id })}>
                <IconX className="size-3.5" />
              </Button>
            </div>
            <div className="mt-2">
              <SpecSteps steps={c.steps} dense />
            </div>
            {c.weakTrigger ? <p className="mt-2 text-xs text-warn">Trigger may be too broad — refine with the agent.</p> : null}
            {other ? (
              <div className="mt-2 rounded-md border border-warn/40 bg-warn/5 p-2 text-xs">
                <p className="flex items-center gap-1.5 font-medium text-warn">
                  <IconUsers className="size-3.5" aria-hidden /> Your team handles this two ways
                </p>
                <p className="mt-1 text-muted-foreground">
                  You: {c.stepLabels.join(" → ")}. {other.actorEmail}: {other.steps.map((s) => s.action).join(" → ")} ({other.episodeIds.length}×). Pick one for the shared playbook.
                </p>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => create.mutate({ candidateId: c.id, name: c.name })} disabled={create.isPending}>
                {other ? "Make playbook (my way)" : "Make playbook"}
              </Button>
              {other ? (
                <Button size="sm" variant="outline" onClick={() => resolve.mutate({ candidateId: c.id, chosenActorEmail: other.actorEmail })} disabled={resolve.isPending}>
                  Use {other.actorEmail.split("@")[0]}'s way
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  sendToAgentChat({
                    message: `Help me refine the pattern "${c.name}" before it becomes a playbook.`,
                    context: `Pattern candidate id: ${c.id}. Trigger: ${c.triggerText}. Steps: ${c.stepLabels.join(" → ")}. Load the apprentice-teacher skill.`,
                    submit: true,
                    openSidebar: true,
                  })
                }
              >
                <IconSparkles className="size-3.5" /> Refine with agent
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
