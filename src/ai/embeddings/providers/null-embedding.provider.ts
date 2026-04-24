import { ServiceUnavailableException } from '@nestjs/common';

import {
  EmbeddingProvider,
  EmbeddingProviderName,
  EmbeddingResult,
} from './embedding-provider.base';

export class NullEmbeddingProvider extends EmbeddingProvider {
  readonly name: EmbeddingProviderName = 'none';
  readonly model = 'none';
  readonly dimensions = 0;

  async generate(): Promise<EmbeddingResult> {
    throw new ServiceUnavailableException(
      'Similarity search is not available in this environment. ' +
        'Set EMBEDDING_PROVIDER and the matching API credentials to enable it.',
    );
  }
}
