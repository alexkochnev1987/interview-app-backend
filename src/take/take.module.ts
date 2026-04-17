import { Module } from '@nestjs/common';
import { TakeController } from './take.controller';
import { InterviewModule } from '../interview/interview.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [InterviewModule, AuthModule],
  controllers: [TakeController],
})
export class TakeModule {}
