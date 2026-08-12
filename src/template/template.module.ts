import { Module } from '@nestjs/common';

import { AuthGuardsModule } from '../auth/auth-guards.module';
import { DatabaseModule } from '../database/database.module';
import { QuestionModule } from '../question/question.module';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';

@Module({
  imports: [DatabaseModule, AuthGuardsModule, QuestionModule],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
