const aiService = require('../ai/ai.service');

function isAiConfigured() {
  return aiService.isAiConfigured();
}

/**
 * @param {{ systemPrompt: string, studentInput: string }} params
 */
async function runSelfEvaluationAi({ systemPrompt, studentInput }) {
  const result = await aiService.generateText({
    systemPrompt,
    userInput: studentInput,
  });
  return {
    text: result.text,
    provider: result.provider,
    model: result.model,
    raw: result.raw,
  };
}

module.exports = { isAiConfigured, runSelfEvaluationAi };
