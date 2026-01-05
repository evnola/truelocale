
import { AgentRole } from '@/types';

export const LLM_CONFIG: Record<AgentRole | 'tone-generator', { provider: string; model: string }> = {
    TRANSLATOR: { provider: 'google', model: 'gemini-2.5-flash' }, // User specified 4.1-mini, assuming typo for 4o-mini or future model. Keeping as requested.
    REVIEWER: { provider: 'openai', model: 'gpt-5-mini' },
    ARBITRATOR: { provider: 'anthropic', model: 'claude-haiku-4-5' },
    JUDGE: { provider: 'google', model: 'gemini-2.5-pro' },
    'tone-generator': { provider: 'google', model: 'gemini-2.5-flash' } // Default for potential future use
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
