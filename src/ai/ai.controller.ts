import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, minutes } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { QuestionDraft } from '../question/interfaces/question.interface';
import { CreateQuestionDto } from '../question/dto/create-question.dto';
import { CandidateSessionGuard } from '../auth/guards/candidate-session.guard';
import { CandidateAiThrottlerGuard } from './guards/candidate-ai-throttler.guard';
import { StaffAiThrottlerGuard } from './guards/staff-ai-throttler.guard';

class ChatHistoryEntryDto {
  @IsIn(['system', 'assistant', 'candidate'])
  role!: 'system' | 'assistant' | 'candidate';

  @IsString()
  content!: string;
}

class ChatDto {
  @IsString()
  question!: string;

  @IsString()
  position!: string;

  @IsString()
  candidateName!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryEntryDto)
  history!: ChatHistoryEntryDto[];

  @IsString()
  message!: string;
}

class GreetDto {
  @IsString()
  candidateName!: string;

  @IsString()
  position!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalQuestions!: number;
}

class DraftQuestionDto {
  @IsOptional()
  @IsObject()
  question?: Partial<CreateQuestionDto>;
}

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @UseGuards(CandidateSessionGuard, CandidateAiThrottlerGuard)
  @Throttle({
    default: {
      limit: 12,
      ttl: minutes(5),
    },
  })
  async chat(@Body() dto: ChatDto) {
    const response = await this.aiService.chat(
      dto.question,
      dto.position,
      dto.candidateName,
      dto.history,
      dto.message,
    );
    return { response };
  }

  @Post('greet')
  @UseGuards(CandidateSessionGuard, CandidateAiThrottlerGuard)
  @Throttle({
    default: {
      limit: 5,
      ttl: minutes(1),
    },
  })
  async greet(@Body() dto: GreetDto) {
    const response = await this.aiService.greet(
      dto.candidateName,
      dto.position,
      dto.totalQuestions,
    );
    return { response };
  }

  @Post('question-draft')
  @UseGuards(JwtAuthGuard, PermissionsGuard, StaffAiThrottlerGuard)
  @RequirePermissions('questions:create')
  @Throttle({
    default: {
      limit: 20,
      ttl: minutes(5),
    },
  })
  draftQuestion(@Body() dto: DraftQuestionDto): Promise<QuestionDraft> {
    return this.aiService.draftQuestion(dto.question ?? {});
  }
}
