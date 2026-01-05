export declare const LLM_CONFIG: {
    TRANSLATOR: {
        provider: string;
        model: string;
    };
    REVIEWER: {
        provider: string;
        model: string;
    };
    ARBITRATOR: {
        provider: string;
        model: string;
    };
    JUDGE: {
        provider: string;
        model: string;
    };
    'tone-generator': {
        provider: string;
        model: string;
    };
};
export interface ThresholdConfig {
    NO_DISPUTE: number;
    ARBITRATOR_UPPER: number;
}
export interface LLMConfig {
    provider: string;
    model: string;
}
export declare const THRESHOLDS: ThresholdConfig;
