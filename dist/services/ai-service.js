"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const openai_1 = require("@ai-sdk/openai");
const anthropic_1 = require("@ai-sdk/anthropic");
const google_1 = require("@ai-sdk/google");
const ai_1 = require("ai");
class AiService {
    constructor() {
        // Attempt to load keys from process.env, or expect them to be set globally
        this.openai = (0, openai_1.createOpenAI)({ apiKey: process.env.OPENAI_API_KEY });
        this.anthropic = (0, anthropic_1.createAnthropic)({ apiKey: process.env.ANTHROPIC_API_KEY });
        this.google = (0, google_1.createGoogleGenerativeAI)({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
    }
    getModel(provider, modelId) {
        if (provider === 'openai')
            return this.openai(modelId);
        if (provider === 'anthropic')
            return this.anthropic(modelId);
        if (provider === 'google')
            return this.google(modelId);
        throw new Error(`Unsupported provider: ${provider}`);
    }
    async generate(provider, modelId, prompt, system) {
        const model = this.getModel(provider, modelId);
        const { text } = await (0, ai_1.generateText)({
            model,
            system,
            prompt,
        });
        return text;
    }
}
exports.AiService = AiService;
