export type EmbeddingProviderName = 'openai' | 'bedrock' | 'none';

export interface EmbeddingResult {
  readonly vector: number[];
  readonly model: string;
  readonly dimensions: number;
}

export abstract class EmbeddingProvider {
  abstract readonly name: EmbeddingProviderName;
  abstract readonly model: string;
  abstract readonly dimensions: number;

  abstract generate(text: string): Promise<EmbeddingResult>;
}
