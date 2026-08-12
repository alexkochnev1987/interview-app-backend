import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { InterviewModule } from '../interview/interview.module';
import { TakeController } from './take.controller';

@Module({
  imports: [InterviewModule, AuthModule],
  controllers: [TakeController],
})
export class TakeModule {}
