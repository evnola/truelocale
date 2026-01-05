import { ThresholdConfig } from '../config/llm.config';
export interface JobSegment {
    id: string;
    index: number;
    source: string;
    targetLanguage?: string;
    currentTranslation: string;
    status: 'PENDING' | 'TRANSLATED' | 'APPROVED' | 'EVALUATION' | 'DISPUTED' | 'ESCALATED' | 'RESOLVED';
    history: ConsensusLog[];
    prevContext?: string;
    nextContext?: string;
}
export interface ConsensusLog {
    step: number;
    role: 'TRANSLATOR' | 'REVIEWER' | 'ARBITRATOR' | 'JUDGE';
    modelUsed: string;
    action: string;
    content: string;
    reasoning?: string;
    timestamp: Date;
}
interface JsonPrompt {
    system: string;
    user_template: Record<string, any>;
}
export interface EngineOptions {
    llmConfig: Record<string, {
        provider: string;
        model: string;
    }>;
    thresholds: ThresholdConfig;
    prompts?: Record<string, JsonPrompt>;
}
export declare class ConsensusEngine {
    private options;
    private aiService;
    constructor(options: EngineOptions);
    private getPrompt;
    private populateTemplate;
    processSegment(segment: JobSegment, targetLanguage: string, globalContext?: string): Promise<JobSegment>;
    private runTranslator;
    private runReviewer;
    private runTranslatorEvaluation;
    private runArbitrator;
    private runJudge;
    private createLog;
}
export {};
