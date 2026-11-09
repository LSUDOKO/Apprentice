import { EmptyState } from "@/components/apprentice/primitives";

export default function QueueIndex() {
  return (
    <div className="p-6">
      <EmptyState
        title="Pick an issue to triage"
        body="Triage it by hand like you always do. Apprentice watches the typed actions you take, and after two similar issues it offers to turn the pattern into a playbook."
      />
    </div>
  );
}
