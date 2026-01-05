# TrueLocale Consensus Engine

**TrueLocale** is an open-source, multi-agent consensus engine designed for high-accuracy translations. It orchestrates multiple LLMs (Translator, Reviewer, Judge, Arbitrator) to autonomously translate, verify, critique, and refine content until a consensus quality threshold is met.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-green.svg)

## 🚀 Features

*   **Multi-Agent Workflow:** Not just a wrapper. Uses a debate protocol between Agents to ensure accuracy.
*   **Role-Based Logic:** separate personas for Translator (Proposes), Reviewer (Critiques), and Arbitrator (Resolves disputes).
*   **Provider Agnostic:** Works with OpenAI, Anthropic, Google Gemini via the Vercel AI SDK.
*   **Configurable Thresholds:** Define your own quality bars for "Auto-Approval" vs "Human Review".
*   **Stateless:** Designed to be used in serverless environments (Next.js API Routes, Cloud Functions).

## 📦 Installation

```bash
npm install @truelocale/core
# or
yarn add @truelocale/core
```

## 🛠️ Usage

### 1. Initialize the Engine

You need to provide API keys and model configurations.

```typescript
import { ConsensusEngine, EngineOptions } from '@truelocale/core';

const options: EngineOptions = {
  llmConfig: {
    TRANSLATOR: { provider: 'openai', model: 'gpt-4o' },
    REVIEWER: { provider: 'anthropic', model: 'claude-3-5-sonnet-20240620' },
    ARBITRATOR: { provider: 'openai', model: 'gpt-4o' },
    JUDGE: { provider: 'google', model: 'gemini-1.5-pro' },
    'translator-evaluator': { provider: 'openai', model: 'gpt-4o' }
  },
  thresholds: {
    NO_DISPUTE: 0.40,      // Below this score, keep original
    ARBITRATOR_UPPER: 0.85 // Above this, trust the Reviewer
  }
};

// Ensure API Keys are in process.env (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
const engine = new ConsensusEngine(options);
```

### 2. Process a Segment

```typescript
const result = await engine.processSegment({
  id: 'segment-1',
  index: 0,
  source: 'Hello world, this is a test.',
  currentTranslation: '',
  status: 'PENDING',
  history: [],
}, 'tr'); // Target Language: Turkish

console.log('Final Translation:', result.currentTranslation);
console.log('Status:', result.status);
```

## 🧠 Architecture

The engine follows a loop:
1.  **Translator** proposes a draft.
2.  **Reviewer** critiques the draft based on linguistic rules and context.
3.  **Translator** evaluates the critique.
    *   *Accepts:* Updates translation.
    *   *Rejects:* Escalates to Arbitrator.
4.  **Arbitrator** (if needed) rules on the dispute.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
