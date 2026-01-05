export const LLM_CONFIG = {
    TRANSLATOR: { provider: 'google', model: 'gemini-2.5-flash' },
    REVIEWER: { provider: 'openai', model: 'gpt-5-mini' },
    ARBITRATOR: { provider: 'anthropic', model: 'claude-haiku-4-5' },
    JUDGE: { provider: 'google', model: 'gemini-2.5-pro' },
    'tone-generator': { provider: 'google', model: 'gemini-2.5-flash' }
};

export interface ThresholdConfig {
    NO_DISPUTE: number;
    ARBITRATOR_UPPER: number;
}

export interface LLMConfig {
    provider: string;
    model: string;
}

export const THRESHOLDS: ThresholdConfig = {
    NO_DISPUTE: 0.40,
    ARBITRATOR_UPPER: 0.75,
};
