const aiService = require('./ai.service');
const { env } = require('../../config/env');
const { success } = require('../../utils/apiResponse');

async function generate(req, res, next) {
  try {
    const { prompt, context } = req.validated.body;
    const userInput = context ? `${context}\n\n${prompt}` : prompt;
    const result = await aiService.generateText({ userInput });
    return success(res, {
      answer: result.text,
      provider: result.provider,
      model: result.model,
    });
  } catch (e) {
    return next(e);
  }
}

async function test(req, res, next) {
  try {
    const result = await aiService.generateText({
      userInput: 'Say hello in Arabic',
      systemPrompt: 'Reply briefly in Arabic.',
    });
    return success(res, {
      answer: result.text,
      provider: result.provider,
      model: result.model,
      configuredProvider: env.AI_PROVIDER || null,
    });
  } catch (e) {
    return next(e);
  }
}

async function status(req, res, next) {
  try {
    return success(res, {
      configured: aiService.isAiConfigured(),
      provider: env.AI_PROVIDER || null,
      model: aiService.getDefaultModel(env.AI_PROVIDER) || null,
    });
  } catch (e) {
    return next(e);
  }
}

module.exports = { generate, test, status };
