export function bindTeamChatEvents({
  app,
  state,
  quickPrompts = [],
  persist,
  render,
  onSendChat,
  onUseQuickPrompt
} = {}) {
  const sendChatBtn = app.querySelector("#send-chat");
  if (sendChatBtn) sendChatBtn.addEventListener("click", onSendChat);

  const chatInput = app.querySelector("#chat-input");
  if (chatInput) {
    chatInput.addEventListener("input", () => {
      state.ui.chatDraft = chatInput.value;
      persist();
    });
    chatInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        onSendChat();
      }
    });
  }

  app.querySelectorAll("[data-quick-prompt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number.parseInt(btn.dataset.quickPrompt, 10);
      if (!Number.isInteger(idx) || idx < 0 || idx >= quickPrompts.length) return;
      onUseQuickPrompt(quickPrompts[idx]);
      render();
    });
  });
}
