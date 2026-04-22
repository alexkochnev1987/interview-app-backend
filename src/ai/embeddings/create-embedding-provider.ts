import { BedrockEmbeddingProvider } from './providers/bedrock-embedding.provider';
import { EmbeddingProvider } from './providers/embedding-provider.base';
import { OpenAIEmbeddingProvider } from './providers/openai-embedding.provider';

export function createEmbeddingProvider(): EmbeddingProvider {
  const raw = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();
  const kind = raw || 'openai';

  if (kind === 'openai' || kind === 'gpt') {
    return new OpenAIEmbeddingProvider();
  }
  if (kind === 'bedrock' || kind === 'aws') {
    return new BedrockEmbeddingProvider();
  }

  throw new Error(
    `Unknown EMBEDDING_PROVIDER "${raw}" (expected: openai | bedrock).`,
  );
}
