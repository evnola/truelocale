export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}
export interface GenerateResult {
    text: string;
    usage: TokenUsage;
}
export declare class AiService {
    private openai;
    private anthropic;
    private google;
    constructor();
    private getModel;
    generate(provider: string, modelId: string, prompt: string, system?: string): Promise<GenerateResult>;
}
