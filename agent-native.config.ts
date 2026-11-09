import { defineAgentNativeConfig } from "@agent-native/core/config";

export default defineAgentNativeConfig({
  changelog: { enabled: false },
  harness: true,
  // Groq keys on the free tier serve gpt-oss, not the framework default llama-3.3.
  agent: { model: "openai/gpt-oss-120b" },
});
