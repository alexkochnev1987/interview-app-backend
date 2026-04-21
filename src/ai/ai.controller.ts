import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, minutes } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { QuestionDraft } from '../question/interfaces/question.interface';
import { CreateQuestionDto } from '../question/dto/create-question.dto';
import { CandidateSessionGuard } from '../auth/guards/candidate-session.guard';
import { CandidateAiThrottlerGuard } from './guards/candidate-ai-throttler.guard';
import { StaffAiThrottlerGuard } from './guards/staff-ai-throttler.guard';

class ChatDto {
  question: string;
  position: string;
  candidateName: string;
  history: { role: 'system' | 'assistant' | 'candidate'; content: string }[];
  message: string;
}

class GreetDto {
  candidateName: string;
  position: string;
  totalQuestions: number;
}

class DraftQuestionDto {
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
  @UseGuards(JwtAuthGuard, RolesGuard, StaffAiThrottlerGuard)
  @Roles('super_admin', 'admin', 'hr')
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
