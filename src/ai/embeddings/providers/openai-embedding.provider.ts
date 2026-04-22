import {
  EmbeddingProvider,
  EmbeddingProviderName,
  EmbeddingResult,
} from './embedding-provider.base';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

interface OpenAIEmbeddingResponse {
  data?: Array<{ embedding?: unknown }>;
}

export class OpenAIEmbeddingProvider extends EmbeddingProvider {
  readonly name: EmbeddingProviderName = 'openai';
  readonly model: string;
  readonly dimensions = DEFAULT_DIMENSIONS;

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    super();
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        'OpenAIEmbeddingProvider requires OPENAI_API_KEY to be set.',
      );
    }
    this.apiKey = apiKey;
    this.model = process.env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;
    this.baseUrl = (
      process.env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL
    ).replace(/\/$/, '');
  }

  async generate(text: string): Promise<EmbeddingResult> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => response.statusText);
      throw new Error(
        `OpenAI embeddings request failed (${response.status}): ${body.slice(0, 500)}`,
      );
    }

    const payload = (await response.json()) as OpenAIEmbeddingResponse;
    const vector = payload.data?.[0]?.embedding;

    if (!Array.isArray(vector) || vector.length !== this.dimensions) {
      throw new Error(
        `OpenAI returned an unexpected embedding shape (expected a ${this.dimensions}-dim array).`,
      );
    }

    return {
      vector: vector as number[],
      model: this.model,
      dimensions: this.dimensions,
    };
  }
}
