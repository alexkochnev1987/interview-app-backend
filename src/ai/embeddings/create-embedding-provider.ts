import { Logger } from '@nestjs/common';

import { BedrockEmbeddingProvider } from './providers/bedrock-embedding.provider';
import { EmbeddingProvider } from './providers/embedding-provider.base';
import { NullEmbeddingProvider } from './providers/null-embedding.provider';
import { OpenAIEmbeddingProvider } from './providers/openai-embedding.provider';

const logger = new Logger('EmbeddingProviderFactory');

export function createEmbeddingProvider(): EmbeddingProvider {
  const raw = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();

  if (raw === 'none') {
    logger.warn(
      'EMBEDDING_PROVIDER=none; similarity search endpoints will return 503.',
    );
    return new NullEmbeddingProvider();
  }

  if (raw === 'openai' || raw === 'gpt') {
    return new OpenAIEmbeddingProvider();
  }

  if (raw === 'bedrock' || raw === 'aws') {
    return new BedrockEmbeddingProvider();
  }

  if (!raw) {
    if (process.env.OPENAI_API_KEY?.trim()) {
      return new OpenAIEmbeddingProvider();
    }
    logger.warn(
      'No EMBEDDING_PROVIDER configured and OPENAI_API_KEY missing; ' +
        'similarity search endpoints will return 503.',
    );
    return new NullEmbeddingProvider();
  }

  throw new Error(
    `Unknown EMBEDDING_PROVIDER "${raw}" (expected: openai | bedrock | none).`,
  );
}
