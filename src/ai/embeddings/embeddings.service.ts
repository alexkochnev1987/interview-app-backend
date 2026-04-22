import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

import { DatabaseService } from '../../database/database.service';
import { EmbeddingProvider } from './providers/embedding-provider.base';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly provider: EmbeddingProvider,
  ) {}

  async generateAndStore(questionId: string, text: string): Promise<void> {
    const hash = hashText(text);
    const existing = await this.db.query<{ text_hash: string }>(
      `SELECT text_hash FROM question_embeddings WHERE question_id = $1 AND model = $2`,
      [questionId, this.provider.model],
    );
    if (existing.rows[0]?.text_hash === hash) {
      return;
    }

    const { vector } = await this.provider.generate(text);

    await this.db.query(
      `
        INSERT INTO question_embeddings (question_id, model, embedding, text_hash)
        VALUES ($1, $2, $3::vector, $4)
        ON CONFLICT (question_id, model) DO UPDATE
          SET embedding = EXCLUDED.embedding,
              text_hash = EXCLUDED.text_hash,
              created_at = NOW()
      `,
      [questionId, this.provider.model, toVectorLiteral(vector), hash],
    );

    this.logger.log(
      `stored embedding for question ${questionId} (model=${this.provider.model})`,
    );
  }
}

function hashText(text: string): string {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
  return createHash('sha256').update(normalized).digest('hex');
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
