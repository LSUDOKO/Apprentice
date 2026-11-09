import { navigateWithAgentChatViewTransition } from "@agent-native/core/client/agent-chat";
import { focusAgentChat } from "@agent-native/toolkit/app/chat";
import { AgentSidebar } from "@agent-native/toolkit/app/chat";
import { type ReactNode } from "react";
import { useNavigate } from "react-router";

import { ChatComposerContextProvider } from "@/components/ChatComposerContext";
import { chatThreadPath } from "@/lib/chat-paths";
import { TAB_ID } from "@/lib/tab-id";

interface AgentInspectorProps {
  children: ReactNode;
  chatHomeHandoffActive: boolean;
  chatHomeHandoffPending: boolean;
}

/** Contextual inspector shell used on secondary chat routes. */
export function AgentInspector({
  children,
  chatHomeHandoffActive,
  chatHomeHandoffPending,
}: AgentInspectorProps) {
  const navigate = useNavigate();

  function openAskAgentFullscreen(threadId?: string) {
    focusAgentChat();
    navigateWithAgentChatViewTransition(navigate, chatThreadPath(threadId));
  }

  return (
    <AgentSidebar
      composerContextProvider={ChatComposerContextProvider}
      position="right"
      chatViewTransition
      chatViewTransitionHandoff={chatHomeHandoffPending}
      storageKey="chat"
      browserTabId={TAB_ID}
      openOnChatRunning={chatHomeHandoffActive}
      onFullscreenRequest={openAskAgentFullscreen}
      emptyStateText="I'm Apprentice. I learn your triage by watching, then earn the right to do it for you."
      agentPageHref="/settings/agent"
      suggestions={["What have I been doing today?", "Run my playbooks on new issues", "Which playbooks are ready to promote?", "Why did you do that?"]}
    >
      {children}
    </AgentSidebar>
  );
}
