
import { AiService } from '../services/ai-service';
import { LLMConfig, ThresholdConfig } from '../config/llm.config';
import translatorPrompt from '../config/translator.json';
import reviewerPrompt from '../config/reviewer.json';
import judgePrompt from '../config/judge.json';
import arbitratorPrompt from '../config/arbitrator.json';
import arbitratorFinalPrompt from '../config/arbitrator-final.json';
import translatorEvaluatorPrompt from '../config/translator-evaluator.json';

// Interfaces for the library
export interface JobSegment {
    id: string;
    index: number;
    source: string;
    targetLanguage?: string; // Optional override
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
    inputTokens?: number;
    outputTokens?: number;
    requestContent?: string;
}

interface JsonPrompt {
    system: string;
    user_template: Record<string, any>;
}

const DEFAULT_PROMPTS: Record<string, JsonPrompt> = {
    'translator': translatorPrompt as unknown as JsonPrompt,
    'reviewer': reviewerPrompt as unknown as JsonPrompt,
    'judge': judgePrompt as unknown as JsonPrompt,
    'arbitrator': arbitratorPrompt as unknown as JsonPrompt,
    'arbitrator-final': arbitratorFinalPrompt as unknown as JsonPrompt,
    'translator-evaluator': translatorEvaluatorPrompt as unknown as JsonPrompt,
};

export interface EngineOptions {
    llmConfig: Record<string, { provider: string; model: string }>;
    thresholds: ThresholdConfig;
    prompts?: Record<string, JsonPrompt>; // Allow overriding prompts
    workflow?: 'standard' | 'fast'; // 'standard' = ABACD, 'fast' = ABCD (skip A2)
    useJudge?: boolean; // If false, Arbitrator makes final decision
}

export class ConsensusEngine {
    private options: EngineOptions;
    private aiService: AiService;

    constructor(options: EngineOptions) {
        this.options = options;
        this.aiService = new AiService();
    }

    private getPrompt(name: string): JsonPrompt {
        return this.options.prompts?.[name] || DEFAULT_PROMPTS[name];
    }

    private populateTemplate(template: any, variables: Record<string, string | number | undefined>): any {
        if (typeof template === 'string') {
            let output = template;
            for (const [key, value] of Object.entries(variables)) {
                output = output.replace(new RegExp(`{{${key}}}`, 'g'), String(value || ''));
            }
            return output;
        } else if (Array.isArray(template)) {
            return template.map(item => this.populateTemplate(item, variables));
        } else if (typeof template === 'object' && template !== null) {
            const result: any = {};
            for (const [key, value] of Object.entries(template)) {
                result[key] = this.populateTemplate(value, variables);
            }
            return result;
        }
        return template;
    }

    async processSegment(segment: JobSegment, targetLanguage: string, globalContext?: string): Promise<JobSegment> {
        const updatedSegment = { ...segment };
        const context = globalContext || 'No global context provided.';

        switch (segment.status) {
            case 'PENDING':
                return this.runTranslator(updatedSegment, targetLanguage, context);
            case 'TRANSLATED':
                return this.runReviewer(updatedSegment, targetLanguage, context);
            case 'EVALUATION':
                return this.runTranslatorEvaluation(updatedSegment, context);
            case 'DISPUTED':
                return this.runArbitrator(updatedSegment, context);
            case 'ESCALATED':
                return this.runJudge(updatedSegment, targetLanguage, context);
            default:
                return updatedSegment;
        }
    }

    private async runTranslator(segment: JobSegment, targetLanguage: string, globalContext?: string): Promise<JobSegment> {
        // console.log(`[Agent A] Translating segment ${segment.id}`);

        const { system, user_template } = this.getPrompt('translator');
        const populatedSystem = this.populateTemplate(system, { globalContext });

        const userObject = this.populateTemplate(user_template, {
            targetLanguage,
            tone: 'neutral',
            prevContext: segment.prevContext,
            nextContext: segment.nextContext,
            source: segment.source
        });

        const config = this.options.llmConfig.TRANSLATOR;
        const validPrompt = `Please EXECUTE the following translation task.\nRefer to the "instruction" field within the JSON for specific rules.\n\nINPUT TASK:\n${JSON.stringify(userObject, null, 2)}`;

        const result = await this.aiService.generate(
            config.provider,
            config.model,
            validPrompt,
            populatedSystem
        );

        segment.currentTranslation = result.text.trim();
        segment.status = 'TRANSLATED';
        segment.history.push(this.createLog('TRANSLATOR', 'PROPOSE', result.text, undefined, result.usage.inputTokens, result.usage.outputTokens, validPrompt));

        return segment;
    }

    private async runReviewer(segment: JobSegment, targetLanguage: string, globalContext?: string): Promise<JobSegment> {
        // console.log(`[Agent B] Reviewing segment ${segment.id}`);

        const { system, user_template } = this.getPrompt('reviewer');
        const populatedSystem = this.populateTemplate(system, { globalContext });

        const userObject = this.populateTemplate(user_template, {
            source: segment.source,
            translation: segment.currentTranslation,
            targetLanguage,
            prevContext: segment.prevContext,
            nextContext: segment.nextContext
        });

        const config = this.options.llmConfig.REVIEWER;
        const validPrompt = JSON.stringify(userObject);
        const result = await this.aiService.generate(
            config.provider,
            config.model,
            validPrompt,
            populatedSystem
        );

        let parsed: { status: string; correction?: string; reason?: string };

        try {
            const cleanJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
            parsed = JSON.parse(cleanJson);
        } catch (e) {
            const isApproved = result.text.toLowerCase().includes('approved') || result.text.toLowerCase().includes('looks good');
            parsed = {
                status: isApproved ? 'APPROVED' : 'CHANGES_REQUESTED',
                correction: result.text,
                reason: 'Parsed from raw output (JSON failed).'
            };
        }

        if (parsed.status === 'APPROVED') {
            segment.status = 'APPROVED';
            segment.history.push(this.createLog('REVIEWER', 'ACCEPT_CRITIQUE', 'Translation verified.', parsed.reason, result.usage.inputTokens, result.usage.outputTokens, validPrompt));
        } else {
            // Check workflow to decide next step
            if (this.options.workflow === 'fast') {
                segment.status = 'DISPUTED'; // Skip A2 (Evaluation), Go directly to C (Arbitrator)
            } else {
                segment.status = 'EVALUATION'; // Standard ABACD flow
            }

            const correction = parsed.correction || 'No correction provided';
            const reason = parsed.reason || 'No reason provided';
            segment.history.push(this.createLog('REVIEWER', 'CRITIQUE', correction, reason, result.usage.inputTokens, result.usage.outputTokens, validPrompt));
        }

        return segment;
    }

    private async runTranslatorEvaluation(segment: JobSegment, globalContext?: string): Promise<JobSegment> {
        // console.log(`[Agent A] Evaluating review for segment ${segment.id}`);

        const { system, user_template } = this.getPrompt('translator-evaluator');
        const populatedSystem = this.populateTemplate(system, { globalContext });

        const critiqueLog = segment.history.filter(h => h.role === 'REVIEWER' && h.action === 'CRITIQUE').pop();
        if (!critiqueLog) {
            segment.status = 'DISPUTED';
            return segment;
        }

        const userObject = this.populateTemplate(user_template, {
            source: segment.source,
            originalTranslation: segment.currentTranslation,
            reviewerSuggestion: critiqueLog.content
        });

        const config = this.options.llmConfig.TRANSLATOR;
        const validPrompt = JSON.stringify(userObject);
        const response = await this.aiService.generate(
            config.provider,
            config.model,
            validPrompt,
            populatedSystem
        );

        try {
            const cleanJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanJson);

            if (result.decision === 'ACCEPT') {
                segment.status = 'RESOLVED';
                segment.currentTranslation = result.final_text || segment.currentTranslation;
                segment.history.push(this.createLog('TRANSLATOR', 'ACCEPT_CRITIQUE', `Agreed. ${result.reasoning}`, undefined, response.usage.inputTokens, response.usage.outputTokens, validPrompt));
            } else {
                segment.status = 'DISPUTED';
                segment.currentTranslation = result.final_text || segment.currentTranslation;
                segment.history.push(this.createLog('TRANSLATOR', 'REJECT_CRITIQUE', `Rejected. ${result.reasoning}`, undefined, response.usage.inputTokens, response.usage.outputTokens, validPrompt));
            }

        } catch (e) {
            segment.status = 'DISPUTED';
        }

        return segment;
    }

    private async runArbitrator(segment: JobSegment, globalContext?: string): Promise<JobSegment> {
        // console.log(`[Agent C] Arbitrating segment ${segment.id}`);

        const useJudge = this.options.useJudge ?? true; // Default to true if not specified
        const promptKey = useJudge ? 'arbitrator' : 'arbitrator-final';
        const { system, user_template } = this.getPrompt(promptKey);

        const populatedSystem = this.populateTemplate(system, {
            threshold_low: this.options.thresholds.NO_DISPUTE,
            threshold_high: this.options.thresholds.ARBITRATOR_UPPER,
            globalContext
        });

        const originalTranslation = segment.currentTranslation;
        const reviewerCritique = segment.history[segment.history.length - 1].content;

        const userObject = this.populateTemplate(user_template, {
            source: segment.source,
            originalTranslation,
            reviewerSuggestion: reviewerCritique
        });

        const config = this.options.llmConfig.ARBITRATOR;
        const validPrompt = JSON.stringify(userObject);
        const response = await this.aiService.generate(
            config.provider,
            config.model,
            validPrompt,
            populatedSystem
        );

        try {
            const cleanJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanJson);

            const decision = result.verdict || (result.score < this.options.thresholds.NO_DISPUTE ? 'KEEP_ORIGINAL' : 'ESCALATE');
            const confidence = result.confidence ?? 'N/A';
            const reasoning = result.reasoning ?? 'No reasoning parsed.';
            const recommendation = result.recommendation ?? 'No recommendation provided.';

            let logContent = `Score: ${result.score}. Confidence: ${confidence}. Decision: ${decision}. Reasoning: ${reasoning}`;

            // Handle No-Judge Mode Logic
            if (!useJudge) {
                if (decision === 'KEEP_ORIGINAL') {
                    segment.status = 'RESOLVED';
                    segment.currentTranslation = result.final_text || originalTranslation;
                } else if (decision === 'ACCEPT_REVIEWER') {
                    segment.status = 'RESOLVED';
                    segment.currentTranslation = result.final_text || reviewerCritique;
                } else if (decision === 'REWRITE') {
                    segment.status = 'RESOLVED';
                    segment.currentTranslation = result.final_text || segment.currentTranslation;
                } else {
                    // Fallback for unexpected verdicts
                    segment.status = 'RESOLVED';
                }
                logContent += ` [FINAL AUTHORITY]`;
            } else {
                // Standard Logic with Judge
                if (decision === 'KEEP_ORIGINAL') {
                    segment.status = 'RESOLVED';
                } else if (decision === 'ACCEPT_REVIEWER') {
                    segment.status = 'RESOLVED';
                    segment.currentTranslation = reviewerCritique;
                } else {
                    segment.status = 'ESCALATED';
                    logContent += `. Recommendation: ${recommendation}`;
                }
            }

            segment.history.push(this.createLog('ARBITRATOR', 'RULING', logContent, undefined, response.usage.inputTokens, response.usage.outputTokens, validPrompt));

        } catch (e) {
            console.error('Arbitrator parsing error:', e);
            // If judge is used, escalate. If not, default to original.
            if (useJudge) {
                segment.status = 'ESCALATED';
            } else {
                segment.status = 'RESOLVED';
                segment.history.push(this.createLog('ARBITRATOR', 'ERROR', 'Failed to parse arbitration result. Kept original.', undefined, response.usage.inputTokens, response.usage.outputTokens, validPrompt));
            }
        }

        return segment;
    }

    private async runJudge(segment: JobSegment, targetLanguage: string, globalContext?: string): Promise<JobSegment> {
        // console.log(`[Agent D] Judging segment ${segment.id}`);

        const { system, user_template } = this.getPrompt('judge');
        const populatedSystem = this.populateTemplate(system, { globalContext });

        const historyText = segment.history.map(h => `${h.role}: ${h.action} -> ${h.content}`).join('\n');

        const userObject = this.populateTemplate(user_template, {
            source: segment.source,
            targetLanguage,
            history: historyText
        });

        const config = this.options.llmConfig.JUDGE;
        const validPrompt = JSON.stringify(userObject);
        const response = await this.aiService.generate(
            config.provider,
            config.model,
            validPrompt,
            populatedSystem
        );

        let result: { final_translation: string; reasoning?: string };
        try {
            const cleanJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            result = JSON.parse(cleanJson);
        } catch (e) {
            result = { final_translation: response.text, reasoning: 'Failed to parse reasoning.' };
        }

        segment.currentTranslation = result.final_translation.trim();
        segment.status = 'RESOLVED';
        segment.history.push(this.createLog('JUDGE', 'RULING', result.final_translation, result.reasoning, response.usage.inputTokens, response.usage.outputTokens, validPrompt));

        return segment;
    }

    private createLog(role: ConsensusLog['role'], action: ConsensusLog['action'], content: string, reasoning?: string, inputTokens?: number, outputTokens?: number, requestContent?: string): ConsensusLog {
        const log: ConsensusLog = {
            step: Date.now(),
            role,
            modelUsed: this.options.llmConfig[role].model,
            action,
            content,
            timestamp: new Date(),
            inputTokens,
            outputTokens,
            requestContent
        };

        if (reasoning) {
            log.reasoning = reasoning;
        }

        return log;
    }
}
