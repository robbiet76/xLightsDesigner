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

test("direct specialist address acts as a routing hint, not a hard dispatch", async () => {
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
  assert.equal(result.result.routeDecision, "audio_analyst");
  assert.equal(result.result.handledBy, "audio_analyst");
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
