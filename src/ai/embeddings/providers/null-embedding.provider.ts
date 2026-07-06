import { ApiErrorCode } from '../../../common/errors/api-error.codes';
import { apiServiceUnavailable } from '../../../common/errors/api-error';

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
    throw apiServiceUnavailable(
      ApiErrorCode.EMBEDDING_PROVIDER_NOT_CONFIGURED,
      'Similarity search is not available in this environment. ' +
        'Set EMBEDDING_PROVIDER and the matching API credentials to enable it.',
    );
  }
}
