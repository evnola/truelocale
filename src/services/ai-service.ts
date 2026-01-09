import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}

export interface GenerateResult {
    text: string;
    usage: TokenUsage;
}

export class AiService {
    private openai: ReturnType<typeof createOpenAI>;
    private anthropic: ReturnType<typeof createAnthropic>;
    private google: ReturnType<typeof createGoogleGenerativeAI>;

    constructor() {
        // Attempt to load keys from process.env, or expect them to be set globally
        this.openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        this.google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
    }

    private getModel(provider: string, modelId: string) {
        if (provider === 'openai') return this.openai(modelId);
        if (provider === 'anthropic') return this.anthropic(modelId);
        if (provider === 'google') return this.google(modelId);
        throw new Error(`Unsupported provider: ${provider}`);
    }

    async generate(
        provider: string,
        modelId: string,
        prompt: string,
        system?: string
    ): Promise<GenerateResult> {
        const model = this.getModel(provider, modelId);

        const { text, usage } = await generateText({
            model,
            system,
            prompt,
        });

        const tokenUsage = usage as any;
        return {
            text,
            usage: {
                inputTokens: tokenUsage?.inputTokens ?? tokenUsage?.promptTokens ?? 0,
                outputTokens: tokenUsage?.outputTokens ?? tokenUsage?.completionTokens ?? 0,
                totalTokens: tokenUsage?.totalTokens ?? (
                    (tokenUsage?.inputTokens ?? tokenUsage?.promptTokens ?? 0) +
                    (tokenUsage?.outputTokens ?? tokenUsage?.completionTokens ?? 0)
                ),
            },
        };
    }
}
