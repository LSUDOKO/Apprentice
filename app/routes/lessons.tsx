import { actionErrorMessage, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { recorder } from "@agent-native/core/client/recorder";
import { IconPlayerRecord } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { EmptyState, ErrorState, RowsSkeleton, timeAgo } from "@/components/apprentice/primitives";
import { PlainSteps } from "@/components/apprentice/Steps";
import { Button } from "@/components/ui/button";

export default function Lessons() {
  const { data, isPending, error, refetch } = useActionQuery("list-lessons", {});
  const navigate = useNavigate();
  const start = useActionMutation("start-lesson", {
    onSuccess: (r) => {
      recorder.log("apprentice.lesson.start", { lessonId: r.lessonId });
      toast.success("Recording. Triage an issue the way you want it done, narrate why, then Stop.");
      navigate("/issues");
    },
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't start the lesson."),
  });
  if (isPending) return <RowsSkeleton className="p-6" rows={4} />;
  if (error || !data) return <div className="p-6"><ErrorState error={error} onRetry={() => void refetch()} /></div>;
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <section className="rounded-[10px] border border-border bg-card p-5">
        <h2 className="font-medium">Teach on purpose</h2>
        <p className="mt-1 max-w-prose text-[13px] text-muted-foreground">
          A lesson is a demonstration with intent. Apprentice merges the framework Recorder's timeline (actions, navigation, state) with your narration —
          typed or dictated — into one high-quality example.
        </p>
        <Button className="mt-3" onClick={() => start.mutate({})} disabled={!!data.active || start.isPending}>
          <IconPlayerRecord className="size-4 text-bad" /> {data.active ? "Recording…" : "Record a lesson"}
        </Button>
      </section>
      {data.lessons.length === 0 ? (
        <EmptyState title="No lessons yet" body="Watch mode already learns from everyday triage. Lessons are for teaching something specific, with your reasons attached." />
      ) : (
        <ul className="space-y-3">
          {data.lessons.map((l) => (
            <li key={l.id} className="rounded-[10px] border border-border bg-card p-4 text-[13px]">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Lesson · {timeAgo(l.startedAt)}</span>
                <span className="rounded border border-border px-1.5 text-[11px] text-muted-foreground">{l.status}</span>
                <span className="text-xs text-muted-foreground">{l.events} recorder events · {l.demonstrations.length} demonstration(s)</span>
              </p>
              {l.narration ? <p className="mt-2 italic text-muted-foreground">“{l.narration}”</p> : null}
              <ul className="mt-2 space-y-2">
                {l.demonstrations.map((d) => (
                  <li key={d.id}>
                    <p className="text-xs text-muted-foreground">#{d.number} {d.title}</p>
                    <PlainSteps steps={d.steps} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
