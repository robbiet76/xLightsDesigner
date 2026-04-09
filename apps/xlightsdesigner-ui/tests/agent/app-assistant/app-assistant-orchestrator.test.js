import test from "node:test";
import assert from "node:assert/strict";

import { executeAppAssistantConversation } from "../../../agent/app-assistant/app-assistant-orchestrator.js";

test("app assistant routes setup-help questions without proposal generation", async () => {
  const bridge = {
    async runAgentConversation() {
      return {
        ok: true,
        assistantMessage: "Set the show folder first, then choose the media path.",
        shouldGenerateProposal: false,
        proposalIntent: "",
        responseId: "resp-1"
      };
    }
  };

  const result = await executeAppAssistantConversation({
    userMessage: "How do I set up the show folder and media path?",
    messages: [],
    context: { route: "project", sequenceOpen: false },
    bridge
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.routeDecision, "setup_help");
  assert.equal(result.result.shouldGenerateProposal, false);
  assert.equal(result.result.provider, "");
  assert.equal(result.result.handledBy, "app_assistant");
});

test("app assistant routes design conversation to designer and allows proposal generation when sequence is open", async () => {
  const bridge = {
    async runAgentConversation() {
      return {
        ok: true,
        provider: "openai",
        model: "gpt-5.4",
        assistantMessage: "I can turn that nostalgic chorus idea into a first proposal.",
        shouldGenerateProposal: true,
        proposalIntent: "Make the chorus warmer and more nostalgic",
        responseId: "resp-2"
      };
    }
  };

  const result = await executeAppAssistantConversation({
    userMessage: "This chorus should feel like childhood Christmas memories",
    messages: [],
    context: { route: "design", sequenceOpen: true, planOnlyMode: false },
    bridge
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.routeDecision, "designer_dialog");
  assert.equal(result.result.shouldGenerateProposal, true);
  assert.equal(result.result.provider, "openai");
  assert.equal(result.result.model, "gpt-5.4");
  assert.equal(result.result.handledBy, "designer_dialog");
});

test("app assistant routes analysis requests to audio_analyst", async () => {
  const bridge = {
    async runAgentConversation() {
      return {
        ok: true,
        assistantMessage: "I can rerun analysis for beats, bars, and lyrics.",
        shouldGenerateProposal: false,
        responseId: "resp-3"
      };
    }
  };

  const result = await executeAppAssistantConversation({
    userMessage: "Please analyze this song again and refresh the beat map",
    messages: [],
    context: { route: "sequence", sequenceOpen: true },
    bridge
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.routeDecision, "audio_analyst");
  assert.equal(result.result.handledBy, "audio_analyst");
});

test("app assistant biases generic audio-page conversation toward audio_analyst", async () => {
  const bridge = {
    async runAgentConversation() {
      return {
        ok: true,
        assistantMessage: "Here is what I found in the current audio artifact.",
        shouldGenerateProposal: false,
        responseId: "resp-audio-context"
      };
    }
  };

  const result = await executeAppAssistantConversation({
    userMessage: "What did you find so far?",
    messages: [],
    context: { route: "audio", sequenceOpen: true },
    bridge
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.routeDecision, "audio_analyst");
  assert.equal(result.result.handledBy, "audio_analyst");
});

test("app assistant biases generic review-page conversation toward sequence_agent", async () => {
  const bridge = {
    async runAgentConversation() {
      return {
        ok: true,
        assistantMessage: "The current plan is ready for review.",
        shouldGenerateProposal: false,
        responseId: "resp-review-context"
      };
    }
  };

  const result = await executeAppAssistantConversation({
    userMessage: "What should I check before I apply this?",
    messages: [],
    context: { route: "review", sequenceOpen: true },
    bridge
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.routeDecision, "sequence_agent");
  assert.equal(result.result.handledBy, "sequence_agent");
});

test("direct specialist address routes directly to the addressed role", async () => {
  const bridge = {
    async runAgentConversation() {
      return {
        ok: true,
        assistantMessage: "I should refresh the beat map before you sequence against it.",
        shouldGenerateProposal: false,
        responseId: "resp-4"
      };
    }
  };

  const result = await executeAppAssistantConversation({
    userMessage: "Hey Patch, analyze this song again and refresh the beats",
    messages: [],
    context: {
      route: "sequence",
      sequenceOpen: true,
      teamChat: {
        identities: {
          sequence_agent: { roleId: "sequence_agent", displayName: "Sequencer", nickname: "Patch" }
        }
      }
    },
    bridge
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.addressedTo, "sequence_agent");
  assert.equal(result.result.routeDecision, "sequence_agent");
  assert.equal(result.result.handledBy, "sequence_agent");
});

test("direct app assistant address overrides active display discovery routing", async () => {
  const bridge = {
    async runAgentConversation() {
      return {
        ok: true,
        assistantMessage: "Clover here. I can help with routing or setup from here.",
        shouldGenerateProposal: false,
        responseId: "resp-direct-app-assistant"
      };
    }
  };

  const result = await executeAppAssistantConversation({
    userMessage: "What about you Clover?",
    messages: [],
    context: {
      route: "display",
      displayDiscovery: { status: "in_progress" },
      display: { targetCount: 120, labeledTargetCount: 0 },
      teamChat: {
        identities: {
          app_assistant: { roleId: "app_assistant", displayName: "App Assistant", nickname: "Clover" },
          designer_dialog: { roleId: "designer_dialog", displayName: "Designer", nickname: "Mira" }
        }
      }
    },
    bridge
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.addressedTo, "app_assistant");
  assert.equal(result.result.routeDecision, "general");
  assert.equal(result.result.handledBy, "app_assistant");
});

test("direct sequencer address can bias ambiguous revise requests toward sequence agent", async () => {
  const bridge = {
    async runAgentConversation() {
      return {
        ok: true,
        assistantMessage: "I can tone down the tree motion in Chorus 3.",
        shouldGenerateProposal: false,
        responseId: "resp-5"
      };
    }
  };

  const result = await executeAppAssistantConversation({
    userMessage: "Hey Patch, make the trees less blinky in Chorus 3",
    messages: [],
    context: {
      route: "design",
      sequenceOpen: true,
      teamChat: {
        identities: {
          sequence_agent: { roleId: "sequence_agent", displayName: "Sequencer", nickname: "Patch" }
        }
      }
    },
    bridge
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.addressedTo, "sequence_agent");
  assert.equal(result.result.routeDecision, "sequence_agent");
  assert.equal(result.result.handledBy, "sequence_agent");
});

test("addressed Lyric structure follow-up stays with audio analyst", async () => {
  const bridge = {
    async runAgentConversation() {
      return {
        ok: true,
        assistantMessage: "The first lift happens when the chorus opens up.",
        shouldGenerateProposal: false,
        responseId: "resp-audio-followup"
      };
    }
  };

  const result = await executeAppAssistantConversation({
    userMessage: "Lyric, where does the first real lift happen in this song?",
    messages: [],
    context: {
      route: "design",
      sequenceOpen: true,
      teamChat: {
        identities: {
          audio_analyst: { roleId: "audio_analyst", displayName: "Audio Analyst", nickname: "Lyric" },
          designer_dialog: { roleId: "designer_dialog", displayName: "Designer", nickname: "Mira" }
        }
      }
    },
    bridge
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.addressedTo, "audio_analyst");
  assert.equal(result.result.routeDecision, "audio_analyst");
  assert.equal(result.result.handledBy, "audio_analyst");
});

test("broad design kickoff stays with designer even if assistant text mentions sequencing", async () => {
  const bridge = {
    async runAgentConversation() {
      return {
        ok: true,
        assistantMessage: "I can turn that design intent into sequence changes after we shape the direction.",
        shouldGenerateProposal: true,
        proposalIntent: "I want this sequence to feel warm, welcoming, and a little magical.",
        responseId: "resp-design-kickoff"
      };
    }
  };

  const result = await executeAppAssistantConversation({
    userMessage: "I want this sequence to feel warm, welcoming, and a little magical.",
    messages: [],
    context: { route: "design", sequenceOpen: true, planOnlyMode: false },
    bridge
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.routeDecision, "designer_dialog");
  assert.equal(result.result.handledBy, "designer_dialog");
});

test("explicit effect request routes to sequence agent", async () => {
  const bridge = {
    async runAgentConversation() {
      return {
        ok: true,
        assistantMessage: "I can add that Color Wash to Snowman during Chorus 1.",
        shouldGenerateProposal: true,
        proposalIntent: "Add a Color Wash effect on Snowman during Chorus 1.",
        responseId: "resp-direct-sequence"
      };
    }
  };

  const result = await executeAppAssistantConversation({
    userMessage: "Add a Color Wash effect on Snowman during Chorus 1.",
    messages: [],
    context: { route: "design", sequenceOpen: true, planOnlyMode: false },
    bridge
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.routeDecision, "sequence_agent");
  assert.equal(result.result.handledBy, "sequence_agent");
  assert.equal(result.result.shouldGenerateProposal, true);
});
