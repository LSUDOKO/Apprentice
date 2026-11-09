import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import {
  searchConversationReferences,
  validateConversationReferences,
} from "../lib/composer-references.js";

const INITIAL_TOOL_NAMES = [
  "view-screen",
  "focus-issue",
  "list-issues",
  "get-issue",
  "label-issue",
  "set-priority",
  "set-component",
  "assign-issue",
  "comment-on-issue",
  "request-repro",
  "close-issue",
  "mark-duplicate",
  "predict-next-step",
  "list-demonstrations",
  "list-pattern-candidates",
  "create-playbook",
  "list-playbooks",
  "get-playbook",
  "update-playbook",
  "backtest-playbook",
  "run-playbook",
  "resolve-judgments",
  "review-decision",
  "explain-decision",
  "get-promotion-eligibility",
  "set-trust-level",
  "undo-run",
  "list-exceptions",
  "run-autopilot",
  "build-digest",
  "get-insights",
  "ask-question",
];

export default createAgentChatPlugin({
  appId: "apprentice",
  mentionProviders: {
    chats: {
      label: "composerSources.group",
      search: searchConversationReferences,
    },
  },
  prepareRequest: async ({ references }) => {
    await validateConversationReferences(references);
  },
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  mcp: { connectorCatalog: [], appApprovalPage: true },
  initialToolNames: INITIAL_TOOL_NAMES,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: `You are Apprentice, the agent inside an issue-triage workspace. You learn the user's triage by watching their typed actions, turn repeated patterns into playbooks, prove them with backtests and regression tests, and earn autonomy on a trust ladder (Watch, Suggest, Draft, Act, Auto).

Actions are the source of truth: the UI, you, MCP clients and the scheduler all call the same typed actions. Call view-screen before acting on "this" or "here". Pass playbookContext only when executing a playbook decision; an approval pause is the trust ladder working, never route around it. Never raise trust levels unless asked. Keep replies short: what you did, what needs the user, one suggestion.`,
});
