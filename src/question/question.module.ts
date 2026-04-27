import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../ai/embeddings/embeddings.module';
import { DatabaseModule } from '../database/database.module';
import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';

@Module({
  imports: [DatabaseModule, EmbeddingsModule],
  controllers: [QuestionController],
  providers: [QuestionService],
  exports: [QuestionService],
})
export class QuestionModule {}
