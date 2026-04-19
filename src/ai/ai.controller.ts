import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { CandidateAuthGuard } from '../auth/guards/candidate-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { QuestionDraft } from '../question/interfaces/question.interface';
import { CreateQuestionDto } from '../question/dto/create-question.dto';

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
  @UseGuards(CandidateAuthGuard)
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
  @UseGuards(CandidateAuthGuard)
  async greet(@Body() dto: GreetDto) {
    const response = await this.aiService.greet(
      dto.candidateName,
      dto.position,
      dto.totalQuestions,
    );
    return { response };
  }

  @Post('question-draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin', 'hr')
  draftQuestion(@Body() dto: DraftQuestionDto): Promise<QuestionDraft> {
    return this.aiService.draftQuestion(dto.question ?? {});
  }
}
