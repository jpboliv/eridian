const REINJECT_EVERY_PROMPTS = 20;

function notePrompt(state, { prompt, now = new Date().toISOString(), classify, recordActivation }) {
  state.buddy = state.buddy || {};
  state.buddy.lastPromptAt = now;
  state.buddy.promptClass = classify ? classify(prompt) : 'other';
  if (!state.current || state.current === 'off') return null;
  state.promptsSinceReinject = (state.promptsSinceReinject || 0) + 1;
  if (state.promptsSinceReinject < REINJECT_EVERY_PROMPTS) return null;
  state.promptsSinceReinject = 0;
  if (recordActivation) recordActivation(state, state.current, false);
  return state.current;
}

function resetPromptCounter(state) {
  state.promptsSinceReinject = 0;
  return state;
}

module.exports = { REINJECT_EVERY_PROMPTS, notePrompt, resetPromptCounter };
