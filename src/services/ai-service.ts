import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

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
    ): Promise<string> {
        const model = this.getModel(provider, modelId);

        const { text } = await generateText({
            model,
            system,
            prompt,
        });

        return text;
    }
}
