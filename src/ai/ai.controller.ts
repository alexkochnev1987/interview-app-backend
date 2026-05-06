import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { QuestionDraft } from '../question/interfaces/question.interface';
import { CandidateSessionGuard } from '../auth/guards/candidate-session.guard';
import { CandidateAiThrottlerGuard } from './guards/candidate-ai-throttler.guard';
import { StaffAiThrottlerGuard } from './guards/staff-ai-throttler.guard';
import {
  AiTextResponseDto,
  ChatDto,
  DraftQuestionDto,
  GreetDto,
} from './dto/ai.dto';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';
import { QuestionDraftResponseDto } from '../question/dto/question.responses.dto';

@ApiTags('ai')
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
  @ApiOperation({ summary: 'Candidate chat assistant' })
  @ApiBody({ type: ChatDto })
  @ApiOkResponse({ type: AiTextResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
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
  @ApiOperation({ summary: 'Candidate greeting prompt' })
  @ApiBody({ type: GreetDto })
  @ApiOkResponse({ type: AiTextResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
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
  @ApiOperation({ summary: 'Generate draft question with AI' })
  @ApiBody({ type: DraftQuestionDto })
  @ApiOkResponse({ type: QuestionDraftResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  draftQuestion(@Body() dto: DraftQuestionDto): Promise<QuestionDraft> {
    return this.aiService.draftQuestion(dto.question ?? {});
  }
}
