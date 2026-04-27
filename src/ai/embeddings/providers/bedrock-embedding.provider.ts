import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

import {
  EmbeddingProvider,
  EmbeddingProviderName,
  EmbeddingResult,
} from './embedding-provider.base';

const DEFAULT_MODEL = 'amazon.titan-embed-text-v1';
const DEFAULT_DIMENSIONS = 1536;
const DEFAULT_REGION = 'us-east-1';

interface TitanEmbeddingResponse {
  embedding?: unknown;
}

export class BedrockEmbeddingProvider extends EmbeddingProvider {
  readonly name: EmbeddingProviderName = 'bedrock';
  readonly model: string;
  readonly dimensions = DEFAULT_DIMENSIONS;

  private readonly client: BedrockRuntimeClient;

  constructor() {
    super();
    this.model =
      process.env.BEDROCK_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION?.trim() || DEFAULT_REGION,
    });
  }

  async generate(text: string): Promise<EmbeddingResult> {
    const command = new InvokeModelCommand({
      modelId: this.model,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({ inputText: text }),
    });

    const response = await this.client.send(command);
    const payload = JSON.parse(
      new TextDecoder().decode(response.body),
    ) as TitanEmbeddingResponse;

    const vector = payload.embedding;
    if (!Array.isArray(vector) || vector.length !== this.dimensions) {
      throw new Error(
        `Bedrock returned an unexpected embedding shape (expected a ${this.dimensions}-dim array).`,
      );
    }

    return {
      vector: vector as number[],
      model: this.model,
      dimensions: this.dimensions,
    };
  }
}
