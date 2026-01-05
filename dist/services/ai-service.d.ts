export declare class AiService {
    private openai;
    private anthropic;
    private google;
    constructor();
    private getModel;
    generate(provider: string, modelId: string, prompt: string, system?: string): Promise<string>;
}
