"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.THRESHOLDS = exports.LLM_CONFIG = void 0;
exports.LLM_CONFIG = {
    TRANSLATOR: { provider: 'google', model: 'gemini-2.5-flash' },
    REVIEWER: { provider: 'openai', model: 'gpt-5-mini' },
    ARBITRATOR: { provider: 'anthropic', model: 'claude-haiku-4-5' },
    JUDGE: { provider: 'google', model: 'gemini-2.5-pro' },
    'tone-generator': { provider: 'google', model: 'gemini-2.5-flash' }
};
exports.THRESHOLDS = {
    NO_DISPUTE: 0.40,
    ARBITRATOR_UPPER: 0.75,
};
