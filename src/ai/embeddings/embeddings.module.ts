import { Module } from '@nestjs/common';

import { createEmbeddingProvider } from './create-embedding-provider';
import { EmbeddingsService } from './embeddings.service';
import { EmbeddingProvider } from './providers/embedding-provider.base';

@Module({
  providers: [
    { provide: EmbeddingProvider, useFactory: createEmbeddingProvider },
    EmbeddingsService,
  ],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
